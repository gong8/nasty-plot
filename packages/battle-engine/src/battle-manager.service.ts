import { BattleStreams, Teams } from "@pkmn/sim"
import { processChunk, parseRequest } from "./protocol-parser.service"
import type { SetPredictor } from "./ai/set-predictor"
import { DEFAULT_FORMAT_ID, toId, type GameType } from "@nasty-plot/core"
import {
  defaultSideConditions,
  type BattleState,
  type BattleAction,
  type BattleActionSet,
  type BattleLogEntry,
  type AIPlayer,
  type AIDifficulty,
  type BattleCheckpoint,
  type PredictedSet,
} from "./types"
import { handleAITurn as aiHandleTurn } from "./battle-ai-handler"
import {
  handleP1Request as reqHandleP1,
  handleP2Request as reqHandleP2,
} from "./battle-request-handler"
import { resumeBattle, type ResumableManager } from "./battle-resume"

const START_TIMEOUT_MS = 10_000
const UPDATE_TIMEOUT_MS = 15_000
const PLAYER_ID_PATTERN = /^p[1-4]$/

export function createInitialState(id: string, gameType: GameType): BattleState {
  function makeEmptySide(name: string) {
    return {
      active: gameType === "doubles" ? [null, null] : [null],
      team: [] as never[],
      name,
      sideConditions: defaultSideConditions(),
      canTera: true,
      hasTerastallized: false,
    }
  }

  return {
    phase: "setup",
    gameType,
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
export class BattleManager implements ResumableManager {
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

  // --- ResumableManager interface for battle-resume.ts ---
  _setSuppressingOutput(v: boolean) {
    this.suppressingOutput = v
  }
  _setStarted(v: boolean) {
    this.started = v
  }
  _readStream() {
    this.readStream()
  }
  _getStream() {
    return this.stream
  }
  _setState(state: BattleState) {
    this.state = state
  }
  _setProtocolLog(log: string) {
    this.protocolLog = log
  }
  _setPendingP2Actions(actions: BattleActionSet | null) {
    this.pendingP2Actions = actions
  }
  _setPendingP2Slot2Actions(actions: BattleActionSet | null) {
    this.pendingP2Slot2Actions = actions
  }
  _setPendingP1Slot2Actions(actions: BattleActionSet | null) {
    this.pendingP1Slot2Actions = actions
  }
  _getConfig() {
    return this.config
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
        const aiLeads = this.ai.chooseLeads(
          this.state.sides.p2.team.length || 6,
          this.state.gameType,
        )
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
    const isDoubles = this.state.gameType === "doubles"

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
      const choice = this.buildP1Choice(action, isDoubles)
      this.stream.write(`>p1 ${choice}`)

      if (this.ai && this.pendingP2Actions) {
        await this.delegateAITurn()
      }

      await this.waitForUpdate()
    } finally {
      this.submitting = false
    }
  }

  /** Build the p1 choice string, handling singles, doubles, and forceSwitch. */
  private buildP1Choice(action: BattleAction, isDoubles: boolean): string {
    if (isDoubles && this.pendingP1Slot1Action) {
      // Doubles: combine both slot actions
      const slot1Choice =
        this.pendingP1Slot1Action.type === "move" && this.pendingP1Slot1Action.moveIndex === 0
          ? "pass"
          : actionToChoice(this.pendingP1Slot1Action)
      this.pendingP1Slot1Action = null
      const choice = `${slot1Choice}, ${actionToChoice(action)}`
      console.log("[BattleManager] p1 doubles choice:", choice)
      return choice
    }

    if (isDoubles && this.state.availableActions?.forceSwitch) {
      // Doubles forceSwitch with only one slot needing to switch
      const choice = buildPartialDoublesChoice(
        actionToChoice(action),
        this.state.availableActions.activeSlot ?? 0,
      )
      console.log("[BattleManager] p1 doubles forceSwitch choice:", choice)
      return choice
    }

    // Singles or fallback
    return actionToChoice(action)
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
   * Delegates to battle-resume.ts for the deserialization logic.
   */
  static async resume(
    checkpoint: BattleCheckpoint,
    ai: AIPlayer,
    eventHandler: BattleEventHandler,
  ): Promise<BattleManager> {
    const manager = await resumeBattle(
      checkpoint,
      ai,
      eventHandler,
      (config) => new BattleManager(config),
    )
    return manager as BattleManager
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

    const allEntries = this.parseProtocolFromChunk(chunk)

    // Resolve immediately if battle has ended — sim might not send a final request after |win|
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

  /** Split a raw chunk into protocol lines, dispatching requests and errors inline. */
  private parseProtocolFromChunk(chunk: string): BattleLogEntry[] {
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
    return allEntries
  }

  private handleSimError(errorMsg: string) {
    console.error("[BattleManager] Sim error:", errorMsg)
    this.startError = errorMsg

    // During start(), the timeout handles errors — only resolve mid-battle.
    if (this.state.phase !== "battle") return

    // Resolve pending waiter, or store the error for when waitForUpdate is called.
    if (this.resolveReady) {
      this.resolveWaiter()
    } else {
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
      const preds = this.setPredictor.getPrediction(pokemon.pokemonId)
      if (preds.length === 0) continue

      // Use the most likely prediction
      const top = preds[0]
      const moves = Array.isArray(top.set.moves)
        ? top.set.moves.flat().filter((m): m is string => typeof m === "string")
        : []

      predictions[pokemon.pokemonId] = {
        pokemonId: pokemon.pokemonId,
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
      const isDoubles = this.state.gameType === "doubles"

      if (sideId === "p1") {
        const result = reqHandleP1(parsed, requestJson, isDoubles, {
          state: this.state,
          ai: this.ai,
          eventHandler: this.eventHandler,
          stream: this.stream,
          pendingP2Actions: this.pendingP2Actions,
          pendingP2Slot2Actions: this.pendingP2Slot2Actions,
          pendingP1Slot2Actions: this.pendingP1Slot2Actions,
          pendingP1Slot1Action: this.pendingP1Slot1Action,
          resolveWaiter: () => this.resolveWaiter(),
        })
        this.pendingP1Slot2Actions = result.pendingP1Slot2Actions
        this.pendingP1Slot1Action = result.pendingP1Slot1Action as BattleAction | null
      } else if (sideId === "p2") {
        this.delegateP2Request(parsed, requestJson, isDoubles)
      }
    } catch (err) {
      console.error("[BattleManager] Failed to parse request:", err)
    }
  }

  private async delegateP2Request(
    parsed: ReturnType<typeof parseRequest>,
    requestJson: string,
    isDoubles: boolean,
  ) {
    const result = await reqHandleP2(parsed, requestJson, isDoubles, {
      state: this.state,
      ai: this.ai,
      eventHandler: this.eventHandler,
      stream: this.stream,
      pendingP2Actions: this.pendingP2Actions,
      pendingP2Slot2Actions: this.pendingP2Slot2Actions,
      pendingP1Slot2Actions: this.pendingP1Slot2Actions,
      pendingP1Slot1Action: this.pendingP1Slot1Action,
      resolveWaiter: () => this.resolveWaiter(),
    })
    this.pendingP2Actions = result.pendingP2Actions
    this.pendingP2Slot2Actions = result.pendingP2Slot2Actions
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
        await this.delegateAITurn()
      }

      await this.waitForUpdate()
    } finally {
      this.submitting = false
    }
  }

  /** Delegate AI turn to the extracted handler. */
  private async delegateAITurn() {
    if (!this.ai || !this.pendingP2Actions) return

    const result = await aiHandleTurn({
      ai: this.ai,
      state: this.state,
      pendingP2Actions: this.pendingP2Actions,
      pendingP2Slot2Actions: this.pendingP2Slot2Actions,
      stream: this.stream,
      getSerializedBattle: () => this.getSerializedBattle(),
      formatId: this.config.formatId,
    })
    this.pendingP2Actions = result.pendingP2Actions
    this.pendingP2Slot2Actions = result.pendingP2Slot2Actions
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

  // Parse paste -> PokemonSet[] -> packed string
  try {
    const sets = Teams.import(trimmed)
    if (!sets || sets.length === 0) return null
    return Teams.pack(sets)
  } catch {
    return null
  }
}
