import { Battle, BattleStreams, Teams } from "@pkmn/sim"
import {
  processChunk,
  parseRequest,
  parseRequestForSlot,
  updateSideFromRequest,
} from "./protocol-parser"
import type { SetPredictor } from "./ai/set-predictor"
import { DEFAULT_FORMAT_ID, toId, type GameType } from "@nasty-plot/core"
import type {
  BattleState,
  BattleAction,
  BattleActionSet,
  BattleLogEntry,
  SideConditions,
  AIPlayer,
  AIDifficulty,
  BattleCheckpoint,
  PredictedSet,
} from "./types"

const START_TIMEOUT_MS = 10_000
const UPDATE_TIMEOUT_MS = 15_000
const RESUME_INIT_DELAY_MS = 50
const PLAYER_ID_PATTERN = /^p[1-4]$/

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

export function createInitialState(id: string, format: GameType): BattleState {
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
  gameType: GameType
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
  /** Error received mid-battle before waitForUpdate was called */
  private pendingError: string | null = null
  private lastProtocolChunk = ""
  private protocolLog = ""
  private setPredictor: SetPredictor | null = null
  private submitting = false
  /** Stored slot-0 action while waiting for slot-1 in doubles */
  private pendingP1Slot1Action: BattleAction | null = null
  private suppressingOutput = false

  private static readonly OBSERVATION_COMMANDS: Record<string, string> = {
    move: "moveUsed",
    "-item": "itemRevealed",
    "-ability": "abilityRevealed",
  }

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
    const format = this.config.simFormatId || this.config.formatId || DEFAULT_FORMAT_ID
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
      }, START_TIMEOUT_MS)
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
   *
   * In doubles, this is called twice per turn (once per active slot).
   * The first call stores the action and swaps availableActions to slot 2.
   * The second call combines both and sends to the sim.
   */
  async submitAction(action: BattleAction): Promise<void> {
    const isDoubles = this.state.format === "doubles"

    // Doubles: first slot action — store it and show slot 2's options
    if (isDoubles && this.pendingP1Slot1Action === null && this.pendingP1Slot2Actions) {
      this.pendingP1Slot1Action = action
      // Swap to slot 2 actions so the UI shows the second Pokemon's moves
      this.state.availableActions = this.pendingP1Slot2Actions
      this.pendingP1Slot2Actions = null
      this.state.waitingForChoice = true
      this.eventHandler?.(this.state, [])
      return
    }

    if (this.submitting) return
    this.submitting = true
    this.state.waitingForChoice = false

    try {
      if (isDoubles && this.pendingP1Slot1Action) {
        // Doubles: combine both slot actions
        const slot1Choice =
          this.pendingP1Slot1Action.type === "move" && this.pendingP1Slot1Action.moveIndex === 0
            ? "pass"
            : actionToChoice(this.pendingP1Slot1Action)
        const choice = `${slot1Choice}, ${actionToChoice(action)}`
        this.pendingP1Slot1Action = null
        console.log("[BattleManager] p1 doubles choice:", choice)
        this.stream.write(`>p1 ${choice}`)
      } else if (isDoubles && this.state.availableActions?.forceSwitch) {
        // Doubles forceSwitch with only one slot needing to switch
        const choice = buildPartialDoublesChoice(
          actionToChoice(action),
          this.state.availableActions.activeSlot ?? 0,
        )
        console.log("[BattleManager] p1 doubles forceSwitch choice:", choice)
        this.stream.write(`>p1 ${choice}`)
      } else {
        // Singles or fallback
        this.stream.write(`>p1 ${actionToChoice(action)}`)
      }

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

  /**
   * Create a checkpoint of the current battle state for save/resume.
   * Only valid when the battle is active and waiting for player input.
   */
  getCheckpoint(aiDifficulty: AIDifficulty): BattleCheckpoint | null {
    if (this.state.phase !== "battle" || !this.state.waitingForChoice) {
      return null
    }

    const serializedBattle = this.getSerializedBattle()
    if (!serializedBattle) return null

    return {
      version: 1,
      savedAt: Date.now(),
      serializedBattle,
      battleState: structuredClone(this.state),
      protocolLog: this.protocolLog,
      config: {
        formatId: this.config.formatId,
        simFormatId: this.config.simFormatId,
        gameType: this.config.gameType,
        playerTeam: this.config.playerTeam,
        opponentTeam: this.config.opponentTeam,
        playerName: this.config.playerName || "Player",
        opponentName: this.config.opponentName || "Opponent",
      },
      aiDifficulty,
    }
  }

  /**
   * Resume a battle from a checkpoint.
   * Creates a new BattleManager, initializes the stream, then swaps in the
   * deserialized battle state using Battle.fromJSON() + battle.restart().
   */
  static async resume(
    checkpoint: BattleCheckpoint,
    ai: AIPlayer,
    eventHandler: BattleEventHandler,
  ): Promise<BattleManager> {
    const manager = new BattleManager({
      formatId: checkpoint.config.formatId,
      simFormatId: checkpoint.config.simFormatId,
      gameType: checkpoint.config.gameType,
      playerTeam: checkpoint.config.playerTeam,
      opponentTeam: checkpoint.config.opponentTeam,
      playerName: checkpoint.config.playerName,
      opponentName: checkpoint.config.opponentName,
    })

    manager.setAI(ai)
    manager.suppressingOutput = true
    manager.started = true

    // Start reading the stream (but output is suppressed)
    manager.readStream()

    // Initialize BattleStream plumbing — this creates a throwaway Battle
    // whose only purpose is to set up the `send` callback
    const playerPacked = pasteToPackedTeam(checkpoint.config.playerTeam)
    const opponentPacked = pasteToPackedTeam(checkpoint.config.opponentTeam)
    const format = checkpoint.config.simFormatId || checkpoint.config.formatId || DEFAULT_FORMAT_ID

    manager.stream.write(`>start {"formatid":"${format}"}`)
    manager.stream.write(
      `>player p1 {"name":"${checkpoint.config.playerName}","team":"${escapeTeam(playerPacked || "")}"}`,
    )
    manager.stream.write(
      `>player p2 {"name":"${checkpoint.config.opponentName}","team":"${escapeTeam(opponentPacked || "")}"}`,
    )

    // Let the event loop process stream initialization
    await new Promise((r) => setTimeout(r, RESUME_INIT_DELAY_MS))

    // Capture the send callback from the throwaway battle
    const streamBattle = (manager.stream as unknown as { battle?: { send: unknown } }).battle
    if (!streamBattle) {
      throw new Error("Failed to initialize battle stream for resume")
    }
    const send = streamBattle.send as (...args: unknown[]) => void

    // Deserialize the saved battle and wire it back into the stream
    const restored = Battle.fromJSON(checkpoint.serializedBattle as string)
    restored.restart(send)
    ;(manager.stream as unknown as { battle: unknown }).battle = restored

    // Restore our state and protocol log
    manager.state = structuredClone(checkpoint.battleState)
    manager.protocolLog = checkpoint.protocolLog

    // Re-extract pending actions from the restored battle's active requests
    const p1Request = restored.sides[0]?.activeRequest
    const p2Request = restored.sides[1]?.activeRequest

    if (p2Request && !p2Request.wait) {
      try {
        const parsed = parseRequest(JSON.stringify(p2Request))
        if (parsed.actions) {
          manager.pendingP2Actions = parsed.actions
          if (manager.state.sides.p2.hasTerastallized) {
            manager.pendingP2Actions.canTera = false
          }
        }
        if (manager.state.format === "doubles") {
          const slot2 = parseRequestForSlot(JSON.stringify(p2Request), 1)
          manager.pendingP2Slot2Actions = slot2.actions
        }
      } catch {
        // Non-critical — AI will get actions on next turn
      }
    }

    if (p1Request && !p1Request.wait && manager.state.format === "doubles") {
      try {
        const slot2 = parseRequestForSlot(JSON.stringify(p1Request), 1)
        manager.pendingP1Slot2Actions = slot2.actions
      } catch {
        // Non-critical
      }
    }

    // Re-enable output processing and emit current state
    manager.suppressingOutput = false
    manager.eventHandler = eventHandler
    eventHandler(manager.state, [])

    return manager
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
        try {
          this.processOutput(chunk)
        } catch (err) {
          console.error("[BattleManager] processOutput threw:", err)
        }
      }
    } catch (err) {
      if (!this.destroyed) {
        console.error("[BattleManager] Stream read error:", err)
      }
    }
  }

  /** Process accumulated protocol lines, deduplicating identical chunks from the sim. */
  private processDeduplicatedProtocol(protocolLines: string): BattleLogEntry[] {
    const trimmed = protocolLines.trim()
    if (!trimmed || trimmed === this.lastProtocolChunk) return []

    this.lastProtocolChunk = trimmed
    this.protocolLog += protocolLines
    return processChunk(this.state, protocolLines)
  }

  private processOutput(chunk: string) {
    if (this.suppressingOutput) return
    const lines = chunk.split("\n")
    let protocolLines = ""
    const allEntries: BattleLogEntry[] = []

    for (const line of lines) {
      if (line.startsWith("|request|")) {
        allEntries.push(...this.processDeduplicatedProtocol(protocolLines))
        protocolLines = ""
        this.handleRequest(line.slice(9))
        continue
      }

      if (line.startsWith("|error|")) {
        this.handleSimError(line.slice(7))
        continue
      }

      // Skip stream markers — these differ per player (sideupdate + p1/p2)
      // and break the deduplication check that prevents double-processing.
      if (line === "update" || line === "sideupdate" || PLAYER_ID_PATTERN.test(line)) {
        continue
      }

      protocolLines += line + "\n"
    }

    allEntries.push(...this.processDeduplicatedProtocol(protocolLines))

    // Resolve immediately if battle has ended
    // This is critical because sim might not send a final request after |win|
    if (this.state.phase === "ended") {
      this.resolveWaiter()
    }

    if (this.setPredictor) {
      this.updateSetPredictorFromLines(chunk)
      this.populatePredictions()
    }

    if (allEntries.length > 0 && this.eventHandler) {
      this.eventHandler(this.state, allEntries)
    }
  }

  private handleSimError(errorMsg: string) {
    console.error("[BattleManager] Sim error:", errorMsg)
    this.startError = errorMsg

    if (this.state.phase !== "battle") return

    // Resolve pending waiter so waitForUpdate doesn't hang forever.
    // During start(), the timeout handles errors — only resolve mid-battle.
    if (this.resolveReady) {
      this.resolveWaiter()
    } else {
      // Error arrived before waitForUpdate was called — store it so
      // waitForUpdate can resolve immediately when it's called.
      this.pendingError = errorMsg
    }
  }

  /** Scan protocol lines for p2 observations and update SetPredictor. */
  private updateSetPredictorFromLines(chunk: string) {
    if (!this.setPredictor) return

    for (const line of chunk.split("\n")) {
      const parts = line.split("|")
      if (parts.length < 3) continue

      const observationKey = BattleManager.OBSERVATION_COMMANDS[parts[1]]
      if (!observationKey || !parts[3]) continue

      const ident = parts[2] || ""
      if (!ident.startsWith("p2")) continue

      const pokemonName = ident.replace(/^p2[a-d]?:\s*/, "").trim()
      this.setPredictor.updateFromObservation(toId(pokemonName), { [observationKey]: parts[3] })
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
        this.handleP1Request(parsed, requestJson, isDoubles)
      } else if (sideId === "p2") {
        this.handleP2Request(parsed, requestJson, isDoubles)
      }
    } catch (err) {
      console.error("[BattleManager] Failed to parse request:", err)
    }
  }

  private handleP1Request(
    parsed: ReturnType<typeof parseRequest>,
    requestJson: string,
    isDoubles: boolean,
  ) {
    if (parsed.side) {
      updateSideFromRequest(this.state, "p1", parsed.side)
    }

    // Reset pending slot-1 action on new request (new turn)
    this.pendingP1Slot1Action = null

    if (parsed.teamPreview) {
      this.state.phase = "preview"
      this.state.waitingForChoice = true
    } else if (parsed.wait) {
      this.state.waitingForChoice = false
      if (isDoubles) {
        console.log("[BattleManager] p1 received wait request")
      }
    } else {
      // In doubles, also parse slot 2 actions for p1
      if (isDoubles) {
        const slot2 = parseRequestForSlot(requestJson, 1)

        // If slot 0 has no moves and no forceSwitch but slot 1 needs to act
        // (e.g. forceSwitch: [false, true]), show slot 1's actions directly
        if (
          parsed.actions &&
          !parsed.actions.forceSwitch &&
          parsed.actions.moves.length === 0 &&
          slot2.actions
        ) {
          // Slot 0 passes, show slot 1's forceSwitch directly
          this.pendingP1Slot1Action = { type: "move", moveIndex: 0 } // sentinel for "pass"
          this.state.availableActions = slot2.actions
          this.pendingP1Slot2Actions = null
          console.log("[BattleManager] p1 doubles: slot0 pass, showing slot1 forceSwitch")
        } else {
          this.state.availableActions = parsed.actions
          this.pendingP1Slot2Actions = slot2.actions
        }

        console.log(
          "[BattleManager] p1 request: slot0 moves=%d, slot1 actions=%s, forceSwitch=%s",
          parsed.actions?.moves.length ?? 0,
          slot2.actions ? `moves=${slot2.actions.moves.length}` : "null",
          parsed.actions?.forceSwitch ?? false,
        )
      } else {
        this.state.availableActions = parsed.actions
      }

      if (this.state.availableActions && this.state.sides.p1.hasTerastallized) {
        this.state.availableActions.canTera = false
      }
      this.state.waitingForChoice = true
    }

    this.eventHandler?.(this.state, [])
    this.resolveWaiter()
  }

  private handleP2Request(
    parsed: ReturnType<typeof parseRequest>,
    requestJson: string,
    isDoubles: boolean,
  ) {
    if (parsed.side) {
      updateSideFromRequest(this.state, "p2", parsed.side)
    }

    // Reset stale p2 pending actions on every new p2 request to prevent
    // sending choices for fainted Pokemon on subsequent turns.
    this.pendingP2Actions = null
    this.pendingP2Slot2Actions = null

    if (parsed.teamPreview) {
      // AI will handle team preview when player submits
      return
    }

    if (parsed.wait || !parsed.actions) return

    if (parsed.actions.forceSwitch && this.ai && !this.state.waitingForChoice) {
      // Only p2 needs to switch (p1 is waiting) — AI responds immediately
      if (isDoubles) {
        const slot2 = parseRequestForSlot(requestJson, 1)
        this.handleAIForceSwitchDoubles(parsed.actions, slot2.actions)
      } else {
        this.handleAIForceSwitch(parsed.actions)
      }
      return
    }

    // Store for AI to use when player submits their action
    this.pendingP2Actions = parsed.actions
    if (this.state.sides.p2.hasTerastallized) {
      this.pendingP2Actions.canTera = false
    }
    // In doubles, also store slot 2 actions
    if (isDoubles) {
      const slot2 = parseRequestForSlot(requestJson, 1)
      this.pendingP2Slot2Actions = slot2.actions
      console.log(
        "[BattleManager] p2 request: slot0 moves=%d, slot1=%s",
        parsed.actions?.moves.length ?? 0,
        slot2.actions ? `moves=${slot2.actions.moves.length}` : "null",
      )
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

    await aiThinkDelay(300, 700)
    this.syncMCTSBattleState()

    if (this.state.format === "doubles" && this.pendingP2Slot2Actions) {
      const action1 = await this.ai.chooseAction(this.state, this.pendingP2Actions)
      const action2 = await this.ai.chooseAction(this.state, this.pendingP2Slot2Actions)
      const choice = `${actionToChoice(action1)}, ${actionToChoice(action2)}`
      console.log("[BattleManager] p2 AI doubles choice:", choice)
      this.stream.write(`>p2 ${choice}`)
      this.pendingP2Actions = null
      this.pendingP2Slot2Actions = null
    } else {
      const aiAction = await this.ai.chooseAction(this.state, this.pendingP2Actions)
      const choice = actionToChoice(aiAction)
      console.log("[BattleManager] p2 AI choice:", choice)
      this.stream.write(`>p2 ${choice}`)
      this.pendingP2Actions = null
    }
  }

  /** Pass serialized battle state to MCTS AI if it supports it. */
  private syncMCTSBattleState() {
    const ai = this.ai as { setBattleState?: (json: unknown, fmt?: string) => void } | null
    if (typeof ai?.setBattleState !== "function") return

    const serialized = this.getSerializedBattle()
    if (serialized) {
      ai.setBattleState(serialized, this.config.formatId)
    }
  }

  private async handleAIForceSwitch(actions: BattleActionSet) {
    if (!this.ai) return

    await aiThinkDelay(200, 300)
    const aiAction = await this.ai.chooseAction(this.state, actions)
    this.stream.write(`>p2 ${actionToChoice(aiAction)}`)
  }

  private async handleAIForceSwitchDoubles(
    slot1Actions: BattleActionSet,
    slot2Actions: BattleActionSet | null,
  ) {
    if (!this.ai) return

    await aiThinkDelay(200, 300)
    const action1 = await this.ai.chooseAction(this.state, slot1Actions)

    if (slot2Actions) {
      // If slot1 chose a switch, remove that Pokemon from slot2's options
      // to prevent "can only switch in once" errors when both slots faint
      if (action1.type === "switch") {
        slot2Actions = {
          ...slot2Actions,
          switches: slot2Actions.switches.filter((s) => s.index !== action1.pokemonIndex),
        }
      }
      const action2 = await this.ai.chooseAction(this.state, slot2Actions)
      const choice = `${actionToChoice(action1)}, ${actionToChoice(action2)}`
      console.log("[BattleManager] p2 AI doubles forceSwitch:", choice)
      this.stream.write(`>p2 ${choice}`)
    } else {
      const choice = buildPartialDoublesChoice(
        actionToChoice(action1),
        slot1Actions.activeSlot ?? 0,
      )
      console.log("[BattleManager] p2 AI doubles partial forceSwitch:", choice)
      this.stream.write(`>p2 ${choice}`)
    }
  }

  private resolveWaiter() {
    if (!this.resolveReady) return
    const resolve = this.resolveReady
    this.resolveReady = null
    resolve()
  }

  private async waitForUpdate(): Promise<void> {
    if (this.state.phase === "ended") return
    if (this.pendingError) {
      this.pendingError = null
      return
    }

    await new Promise<void>((resolve) => {
      this.resolveReady = resolve

      // Safety timeout to prevent permanent hangs
      setTimeout(() => {
        if (this.resolveReady === resolve) {
          console.error("[BattleManager] waitForUpdate timed out after 15s")
          this.resolveReady = null
          resolve()
        }
      }, UPDATE_TIMEOUT_MS)
    })
  }
}

/** Simulate AI "thinking" with a randomized delay for realism. */
function aiThinkDelay(baseMs: number, jitterMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, baseMs + Math.random() * jitterMs))
}

/** Build a doubles choice string where only one slot acts and the other passes. */
function buildPartialDoublesChoice(actionStr: string, activeSlot: number): string {
  return activeSlot === 0 ? `${actionStr}, pass` : `pass, ${actionStr}`
}

function actionToChoice(action: BattleAction): string {
  if (action.type === "move") {
    // @pkmn/sim format: move [index] [target] [mega|terastallize]
    let choice = `move ${action.moveIndex}`
    if (action.targetSlot != null) choice += ` ${action.targetSlot}`
    if (action.tera) choice += " terastallize"
    if (action.mega) choice += " mega"
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
