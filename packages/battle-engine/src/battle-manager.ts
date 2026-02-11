import { BattleStreams, Teams } from "@pkmn/sim"
import {
  processChunk,
  parseRequest,
  parseRequestForSlot,
  updateSideFromRequest,
} from "./protocol-parser"
import type { SetPredictor } from "./ai/set-predictor"
import type {
  BattleState,
  BattleFormat,
  BattleAction,
  BattleActionSet,
  BattleLogEntry,
  SideConditions,
  AIPlayer,
  PredictedSet,
} from "./types"

function defaultSideConditions(): SideConditions {
  return {
    stealthRock: false,
    spikes: 0,
    toxicSpikes: 0,
    stickyWeb: false,
    reflect: 0,
    lightScreen: 0,
    auroraVeil: 0,
    tailwind: 0,
  }
}

export function createInitialState(id: string, format: BattleFormat): BattleState {
  function makeEmptySide(name: string) {
    return {
      active: format === "doubles" ? [null, null] : [null],
      team: [] as never[],
      name,
      sideConditions: defaultSideConditions(),
      canTera: true,
      hasTerastallized: false,
    }
  }

  return {
    phase: "setup",
    format,
    turn: 0,
    sides: {
      p1: makeEmptySide("Player"),
      p2: makeEmptySide("Opponent"),
    },
    field: {
      weather: "",
      weatherTurns: 0,
      terrain: "",
      terrainTurns: 0,
      trickRoom: 0,
    },
    winner: null,
    log: [],
    fullLog: [],
    waitingForChoice: false,
    availableActions: null,
    id,
  }
}

interface BattleManagerConfig {
  formatId: string
  simFormatId?: string // @pkmn/sim format ID when different from formatId
  gameType: BattleFormat
  playerTeam: string // Packed or paste format
  opponentTeam: string
  playerName?: string
  opponentName?: string
}

export type BattleEventHandler = (state: BattleState, entries: BattleLogEntry[]) => void

/**
 * BattleManager orchestrates a battle using @pkmn/sim's BattleStream.
 *
 * It handles:
 * - Creating battles via BattleStream
 * - Submitting team choices and move selections
 * - Maintaining normalized BattleState
 * - Routing AI decisions
 */
export class BattleManager {
  private stream: InstanceType<typeof BattleStreams.BattleStream>
  private state: BattleState
  private config: BattleManagerConfig
  private ai: AIPlayer | null = null
  private eventHandler: BattleEventHandler | null = null
  private pendingP2Actions: BattleActionSet | null = null
  private pendingP2Slot2Actions: BattleActionSet | null = null
  private pendingP1Slot2Actions: BattleActionSet | null = null
  private started = false
  private resolveReady: ((value: void) => void) | null = null
  private destroyed = false
  private startError: string | null = null
  private lastProtocolChunk = ""
  private protocolLog = ""
  private setPredictor: SetPredictor | null = null
  private submitting = false

  constructor(config: BattleManagerConfig) {
    this.config = config
    this.state = createInitialState(`battle-${Date.now()}`, config.gameType)
    this.state.sides.p1.name = config.playerName || "Player"
    this.state.sides.p2.name = config.opponentName || "Opponent"
    this.stream = new BattleStreams.BattleStream()
  }

  /** Set the AI player for p2. */
  setAI(ai: AIPlayer) {
    this.ai = ai
  }

  /** Set a SetPredictor for opponent set inference. */
  setSetPredictor(predictor: SetPredictor) {
    this.setPredictor = predictor
  }

  /** Set a callback for state updates. */
  onUpdate(handler: BattleEventHandler) {
    this.eventHandler = handler
  }

  /** Get current battle state. */
  getState(): BattleState {
    return this.state
  }

  /**
   * Start the battle. Returns when the first request is ready.
   */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    // Convert paste format to packed format that @pkmn/sim expects
    const playerPacked = pasteToPackedTeam(this.config.playerTeam)
    const opponentPacked = pasteToPackedTeam(this.config.opponentTeam)

    if (!playerPacked) {
      throw new Error("Failed to parse player team. Check the Showdown paste format.")
    }
    if (!opponentPacked) {
      throw new Error("Failed to parse opponent team. Check the Showdown paste format.")
    }

    // Start reading from the stream
    this.readStream()

    // Write the battle initialization
    const format = this.config.simFormatId || this.config.formatId || "gen9ou"
    this.stream.write(`>start {"formatid":"${format}"}`)
    this.stream.write(
      `>player p1 {"name":"${this.state.sides.p1.name}","team":"${escapeTeam(playerPacked)}"}`,
    )
    this.stream.write(
      `>player p2 {"name":"${this.state.sides.p2.name}","team":"${escapeTeam(opponentPacked)}"}`,
    )

    // Wait for the first request to come in, with a timeout
    await new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve

      setTimeout(() => {
        if (this.resolveReady) {
          this.resolveReady = null
          reject(
            new Error(
              this.startError
                ? `Battle failed to start: ${this.startError}`
                : "Battle timed out waiting for the simulator. Check team/format validity.",
            ),
          )
        }
      }, 10_000)
    })
  }

  /**
   * Submit team preview lead order.
   */
  async chooseLead(leadOrder: number[]): Promise<void> {
    if (this.submitting) return
    this.submitting = true

    try {
      const choice = `team ${leadOrder.join("")}`
      this.stream.write(`>p1 ${choice}`)

      // AI chooses leads
      if (this.ai) {
        const aiLeads = this.ai.chooseLeads(this.state.sides.p2.team.length || 6, this.state.format)
        const aiChoice = `team ${aiLeads.join("")}`
        this.stream.write(`>p2 ${aiChoice}`)
      }

      this.state.phase = "battle"
      await this.waitForUpdate()
    } finally {
      this.submitting = false
    }
  }

  /**
   * Submit a player action (move or switch).
   */
  async submitAction(action: BattleAction): Promise<void> {
    if (this.submitting) return
    this.submitting = true
    this.state.waitingForChoice = false

    try {
      const choice = actionToChoice(action)
      this.stream.write(`>p1 ${choice}`)

      // Let AI make its choice
      if (this.ai && this.pendingP2Actions) {
        await this.handleAITurn()
      }

      await this.waitForUpdate()
    } finally {
      this.submitting = false
    }
  }

  /**
   * Get the serialized battle state for MCTS AI.
   * Returns null if the battle hasn't started or stream has no battle.
   */
  getSerializedBattle(): unknown | null {
    try {
      // Access the underlying Battle object from the stream
      const battle = (this.stream as unknown as { battle?: { toJSON(): unknown } }).battle
      if (battle && typeof battle.toJSON === "function") {
        return battle.toJSON()
      }
    } catch {
      // Stream doesn't expose battle or toJSON failed
    }
    return null
  }

  /**
   * Get the raw protocol log accumulated so far.
   * Used for saving battles and replay.
   */
  getProtocolLog(): string {
    return this.protocolLog
  }

  /** Destroy the battle stream. */
  destroy() {
    this.destroyed = true
    try {
      this.stream.destroy()
    } catch {
      // Stream may already be destroyed
    }
  }

  private async readStream() {
    try {
      for await (const chunk of this.stream) {
        if (this.destroyed) break
        this.processOutput(chunk)
      }
    } catch {
      // Stream closed or errored
    }
  }

  private processOutput(chunk: string) {
    const lines = chunk.split("\n")
    let protocolLines = ""
    const allEntries: BattleLogEntry[] = []

    for (const line of lines) {
      if (line.startsWith("|request|")) {
        // Process accumulated protocol lines, but skip if we already processed
        // the same lines (sim emits identical protocol for each player's chunk)
        if (protocolLines.trim()) {
          if (protocolLines.trim() !== this.lastProtocolChunk) {
            this.lastProtocolChunk = protocolLines.trim()
            this.protocolLog += protocolLines
            const entries = processChunk(this.state, protocolLines)
            allEntries.push(...entries)
          }
          protocolLines = ""
        }

        this.handleRequest(line.slice(9))
        continue
      }

      if (line.startsWith("|error|")) {
        const errorMsg = line.slice(7)
        console.error("[BattleManager] Error:", errorMsg)
        this.startError = errorMsg
        continue
      }

      // Accumulate protocol lines
      protocolLines += line + "\n"
    }

    // Process remaining protocol lines (deduplicated)
    if (protocolLines.trim() && protocolLines.trim() !== this.lastProtocolChunk) {
      this.lastProtocolChunk = protocolLines.trim()
      this.protocolLog += protocolLines
      const entries = processChunk(this.state, protocolLines)
      allEntries.push(...entries)
    }

    // Update SetPredictor from opponent observations
    if (this.setPredictor) {
      this.updateSetPredictorFromLines(chunk)
      this.populatePredictions()
    }

    if (allEntries.length > 0 && this.eventHandler) {
      this.eventHandler(this.state, allEntries)
    }
  }

  /** Scan protocol lines for p2 observations and update SetPredictor. */
  private updateSetPredictorFromLines(chunk: string) {
    if (!this.setPredictor) return
    const lines = chunk.split("\n")
    for (const line of lines) {
      const parts = line.split("|")
      if (parts.length < 3) continue
      const cmd = parts[1]
      const arg0 = parts[2] || ""

      // Only track opponent (p2) observations
      if (!arg0.startsWith("p2")) continue

      const pokemonName = arg0.replace(/^p2[a-d]?:\s*/, "").trim()
      const pokemonId = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, "")

      if (cmd === "move" && parts[3]) {
        this.setPredictor.updateFromObservation(pokemonId, { moveUsed: parts[3] })
      } else if (cmd === "-item" && parts[3]) {
        this.setPredictor.updateFromObservation(pokemonId, { itemRevealed: parts[3] })
      } else if (cmd === "-ability" && parts[3]) {
        this.setPredictor.updateFromObservation(pokemonId, { abilityRevealed: parts[3] })
      }
    }
  }

  /** Build opponentPredictions on state from the SetPredictor's current beliefs. */
  private populatePredictions() {
    if (!this.setPredictor) return

    const predictions: Record<string, PredictedSet> = {}
    for (const pokemon of this.state.sides.p2.team) {
      const preds = this.setPredictor.getPrediction(pokemon.speciesId)
      if (preds.length === 0) continue

      // Use the most likely prediction
      const top = preds[0]
      const moves = Array.isArray(top.set.moves)
        ? top.set.moves.flat().filter((m): m is string => typeof m === "string")
        : []

      predictions[pokemon.speciesId] = {
        pokemonId: pokemon.speciesId,
        predictedMoves: moves,
        predictedItem: top.set.item || undefined,
        predictedAbility: top.set.ability || undefined,
        confidence: top.probability,
      }
    }
    this.state.opponentPredictions = predictions
  }

  private handleRequest(requestJson: string) {
    try {
      const parsed = parseRequest(requestJson)
      const rawReq = JSON.parse(requestJson)
      const sideId = rawReq.side?.id as "p1" | "p2" | undefined
      const isDoubles = this.state.format === "doubles"

      if (sideId === "p1") {
        if (parsed.side) {
          updateSideFromRequest(this.state, "p1", parsed.side)
        }

        if (parsed.teamPreview) {
          this.state.phase = "preview"
          this.state.waitingForChoice = true
        } else if (parsed.wait) {
          this.state.waitingForChoice = false
        } else {
          this.state.availableActions = parsed.actions
          if (this.state.availableActions && this.state.sides.p1.hasTerastallized) {
            this.state.availableActions.canTera = false
          }
          // In doubles, also parse slot 2 actions for p1
          if (isDoubles) {
            const slot2 = parseRequestForSlot(requestJson, 1)
            this.pendingP1Slot2Actions = slot2.actions
          }
          this.state.waitingForChoice = true
        }

        if (this.eventHandler) {
          this.eventHandler(this.state, [])
        }

        // Resolve any pending waiter
        if (this.resolveReady) {
          const resolve = this.resolveReady
          this.resolveReady = null
          resolve()
        }
      } else if (sideId === "p2") {
        if (parsed.side) {
          updateSideFromRequest(this.state, "p2", parsed.side)
        }

        if (parsed.teamPreview) {
          // AI will handle team preview when player submits
        } else if (!parsed.wait && parsed.actions) {
          if (parsed.actions.forceSwitch && this.ai && !this.state.waitingForChoice) {
            // Only p2 needs to switch (p1 is waiting) — AI responds immediately
            if (isDoubles) {
              const slot2 = parseRequestForSlot(requestJson, 1)
              this.handleAIForceSwitchDoubles(parsed.actions, slot2.actions)
            } else {
              this.handleAIForceSwitch(parsed.actions)
            }
          } else {
            // Store for AI to use when player submits their action
            this.pendingP2Actions = parsed.actions
            if (this.pendingP2Actions && this.state.sides.p2.hasTerastallized) {
              this.pendingP2Actions.canTera = false
            }
            // In doubles, also store slot 2 actions
            if (isDoubles) {
              const slot2 = parseRequestForSlot(requestJson, 1)
              this.pendingP2Slot2Actions = slot2.actions
            }
          }
        }
      }
    } catch (err) {
      console.error("[BattleManager] Failed to parse request:", err)
    }
  }

  /**
   * Submit two actions for both active slots in doubles.
   */
  async submitDoubleActions(action1: BattleAction, action2: BattleAction): Promise<void> {
    if (this.submitting) return
    this.submitting = true
    this.state.waitingForChoice = false

    try {
      const choice = `${actionToChoice(action1)}, ${actionToChoice(action2)}`
      this.stream.write(`>p1 ${choice}`)

      // Let AI make its choice
      if (this.ai && this.pendingP2Actions) {
        await this.handleAITurn()
      }

      await this.waitForUpdate()
    } finally {
      this.submitting = false
    }
  }

  private async handleAITurn() {
    if (!this.ai || !this.pendingP2Actions) return

    // Add a small delay for realism
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700))

    // Pass serialized battle to MCTS AI if available
    if (
      "setBattleState" in this.ai &&
      typeof (this.ai as { setBattleState: unknown }).setBattleState === "function"
    ) {
      const serialized = this.getSerializedBattle()
      if (serialized) {
        ;(this.ai as { setBattleState(json: unknown, fmt?: string): void }).setBattleState(
          serialized,
          this.config.formatId,
        )
      }
    }

    if (this.state.format === "doubles" && this.pendingP2Slot2Actions) {
      // Doubles: get action for each slot, combine
      const action1 = await this.ai.chooseAction(this.state, this.pendingP2Actions)
      const action2 = await this.ai.chooseAction(this.state, this.pendingP2Slot2Actions)
      const choice = `${actionToChoice(action1)}, ${actionToChoice(action2)}`
      this.stream.write(`>p2 ${choice}`)
      this.pendingP2Actions = null
      this.pendingP2Slot2Actions = null
    } else {
      const aiAction = await this.ai.chooseAction(this.state, this.pendingP2Actions)
      const choice = actionToChoice(aiAction)
      this.stream.write(`>p2 ${choice}`)
      this.pendingP2Actions = null
    }
  }

  private async handleAIForceSwitch(actions: BattleActionSet) {
    if (!this.ai) return

    // Small delay for realism
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300))

    const aiAction = await this.ai.chooseAction(this.state, actions)
    const choice = actionToChoice(aiAction)
    this.stream.write(`>p2 ${choice}`)
  }

  private async handleAIForceSwitchDoubles(
    slot1Actions: BattleActionSet,
    slot2Actions: BattleActionSet | null,
  ) {
    if (!this.ai) return

    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300))

    const action1 = await this.ai.chooseAction(this.state, slot1Actions)
    if (slot2Actions) {
      const action2 = await this.ai.chooseAction(this.state, slot2Actions)
      const choice = `${actionToChoice(action1)}, ${actionToChoice(action2)}`
      this.stream.write(`>p2 ${choice}`)
    } else {
      const choice = actionToChoice(action1)
      this.stream.write(`>p2 ${choice}`)
    }
  }

  private async waitForUpdate(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.resolveReady = resolve
      // Also resolve if battle has ended
      if (this.state.phase === "ended") {
        this.resolveReady = null
        resolve()
      }
    })
  }
}

function actionToChoice(action: BattleAction): string {
  if (action.type === "move") {
    let choice = `move ${action.moveIndex}`
    if (action.tera) choice += " terastallize"
    if (action.mega) choice += " mega"
    if (action.targetSlot != null) choice += ` ${action.targetSlot}`
    return choice
  }
  return `switch ${action.pokemonIndex}`
}

function escapeTeam(team: string): string {
  return team.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Convert a Showdown paste string into @pkmn/sim's packed team format.
 * If the input is already packed (no newlines, pipe-delimited), returns it as-is.
 */
function pasteToPackedTeam(team: string): string | null {
  const trimmed = team.trim()
  if (!trimmed) return null

  // Already in packed format (single line with pipes, no newlines except between mons)
  if (!trimmed.includes("\n") || (trimmed.includes("|") && !trimmed.includes("Ability:"))) {
    return trimmed
  }

  // Parse paste → PokemonSet[] → packed string
  try {
    const sets = Teams.import(trimmed)
    if (!sets || sets.length === 0) return null
    return Teams.pack(sets)
  } catch {
    return null
  }
}
