import { Battle, BattleStreams, Teams } from "@pkmn/sim"
import { parseRequest, parseRequestForSlot } from "./protocol-parser.service"
import { DEFAULT_FORMAT_ID } from "@nasty-plot/core"
import type {
  BattleState,
  BattleActionSet,
  BattleLogEntry,
  AIPlayer,
  BattleCheckpoint,
} from "./types"

const RESUME_INIT_DELAY_MS = 50

export type BattleEventHandler = (state: BattleState, entries: BattleLogEntry[]) => void

/**
 * Internal interface for the manager fields needed by resume.
 * This avoids making BattleManager internals public.
 */
export interface ResumableManager {
  setAI(ai: AIPlayer): void
  onUpdate(handler: BattleEventHandler): void
  getState(): BattleState

  /** Internal access for resume wiring */
  _setSuppressingOutput(v: boolean): void
  _setStarted(v: boolean): void
  _readStream(): void
  _getStream(): InstanceType<typeof BattleStreams.BattleStream>
  _setState(state: BattleState): void
  _setProtocolLog(log: string): void
  _setPendingP2Actions(actions: BattleActionSet | null): void
  _setPendingP2Slot2Actions(actions: BattleActionSet | null): void
  _setPendingP1Slot2Actions(actions: BattleActionSet | null): void
  _getConfig(): {
    formatId: string
    simFormatId?: string
    gameType: string
    playerTeam: string
    opponentTeam: string
    playerName?: string
    opponentName?: string
  }
}

function escapeTeam(team: string): string {
  return team.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function pasteToPackedTeam(team: string): string | null {
  const trimmed = team.trim()
  if (!trimmed) return null

  if (!trimmed.includes("\n") || (trimmed.includes("|") && !trimmed.includes("Ability:"))) {
    return trimmed
  }

  try {
    const sets = Teams.import(trimmed)
    if (!sets || sets.length === 0) return null
    return Teams.pack(sets)
  } catch {
    return null
  }
}

/**
 * Resume a battle from a checkpoint.
 * Creates a new BattleManager (via factory), initializes the stream, then swaps in
 * the deserialized battle state using Battle.fromJSON() + battle.restart().
 */
export async function resumeBattle(
  checkpoint: BattleCheckpoint,
  ai: AIPlayer,
  eventHandler: BattleEventHandler,
  createManager: (config: BattleCheckpoint["config"]) => ResumableManager,
): Promise<ResumableManager> {
  const manager = createManager(checkpoint.config)

  manager.setAI(ai)
  manager._setSuppressingOutput(true)
  manager._setStarted(true)

  // Start reading the stream (but output is suppressed)
  manager._readStream()

  // Initialize BattleStream plumbing
  const playerPacked = pasteToPackedTeam(checkpoint.config.playerTeam)
  const opponentPacked = pasteToPackedTeam(checkpoint.config.opponentTeam)
  const format = checkpoint.config.simFormatId || checkpoint.config.formatId || DEFAULT_FORMAT_ID

  const stream = manager._getStream()
  stream.write(`>start {"formatid":"${format}"}`)
  stream.write(
    `>player p1 {"name":"${checkpoint.config.playerName}","team":"${escapeTeam(playerPacked || "")}"}`,
  )
  stream.write(
    `>player p2 {"name":"${checkpoint.config.opponentName}","team":"${escapeTeam(opponentPacked || "")}"}`,
  )

  // Let the event loop process stream initialization
  await new Promise((r) => setTimeout(r, RESUME_INIT_DELAY_MS))

  // Capture the send callback from the throwaway battle
  const streamBattle = (stream as unknown as { battle?: { send: unknown } }).battle
  if (!streamBattle) {
    throw new Error("Failed to initialize battle stream for resume")
  }
  const send = streamBattle.send as (...args: unknown[]) => void

  // Deserialize the saved battle and wire it back into the stream
  const restored = Battle.fromJSON(checkpoint.serializedBattle as string)
  restored.restart(send)
  ;(stream as unknown as { battle: unknown }).battle = restored

  // Restore our state and protocol log
  manager._setState(structuredClone(checkpoint.battleState))
  manager._setProtocolLog(checkpoint.protocolLog)

  restorePendingActions(manager, restored)

  // Re-enable output processing and emit current state
  manager._setSuppressingOutput(false)
  manager.onUpdate(eventHandler)
  eventHandler(manager.getState(), [])

  return manager
}

/** Re-extract pending actions from a restored battle's active requests. */
export function restorePendingActions(manager: ResumableManager, restored: Battle): void {
  const state = manager.getState()
  const p1Request = restored.sides[0]?.activeRequest
  const p2Request = restored.sides[1]?.activeRequest

  if (p2Request && !p2Request.wait) {
    try {
      const parsed = parseRequest(JSON.stringify(p2Request))
      if (parsed.actions) {
        const actions = parsed.actions
        if (state.sides.p2.hasTerastallized) {
          actions.canTera = false
        }
        manager._setPendingP2Actions(actions)
      }
      if (state.gameType === "doubles") {
        const slot2 = parseRequestForSlot(JSON.stringify(p2Request), 1)
        manager._setPendingP2Slot2Actions(slot2.actions)
      }
    } catch {
      // Non-critical — AI will get actions on next turn
    }
  }

  if (p1Request && !p1Request.wait && state.gameType === "doubles") {
    try {
      const slot2 = parseRequestForSlot(JSON.stringify(p1Request), 1)
      manager._setPendingP1Slot2Actions(slot2.actions)
    } catch {
      // Non-critical
    }
  }
}
