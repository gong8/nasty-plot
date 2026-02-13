import { BattleStreams, Teams } from "@pkmn/sim"
import {
  processChunk,
  parseRequest,
  parseRequestForSlot,
  updateSideFromRequest,
} from "../protocol-parser"
import { createInitialState } from "../battle-manager.service"
import { DEFAULT_FORMAT_ID, type GameType } from "@nasty-plot/core"
import type { BattleState, BattleAction, BattleActionSet, AIPlayer } from "../types"

export interface SingleBattleResult {
  winner: "p1" | "p2" | "draw"
  turnCount: number
  protocolLog: string
  team1Paste: string
  team2Paste: string
  /** Per-turn actions (for analytics) */
  turnActions: { turn: number; p1: string; p2: string }[]
  /** Final state snapshot */
  finalState: BattleState
}

export interface AutomatedBattleConfig {
  formatId: string
  simFormatId?: string // @pkmn/sim format ID when different from formatId
  gameType: GameType
  team1Paste: string
  team2Paste: string
  team1Name?: string
  team2Name?: string
  ai1: AIPlayer
  ai2: AIPlayer
  /** Max turns before declaring draw. Default: 500 */
  maxTurns?: number
  /** PRNG seed for the battle simulator. If omitted, uses default (deterministic). */
  seed?: [number, number, number, number]
}

const STREAM_MARKER_RE = /^(?:update|sideupdate|p[1-4])$/
const REQUEST_PREFIX = "|request|"
const REQUEST_PREFIX_LEN = REQUEST_PREFIX.length

/**
 * Runs a fully automated battle between two AIs with no delay.
 * Optimized for speed — no UI callbacks or artificial delays.
 */
export async function runAutomatedBattle(
  config: AutomatedBattleConfig,
): Promise<SingleBattleResult> {
  const maxTurns = config.maxTurns ?? 500
  const stream = new BattleStreams.BattleStream()
  const state = createInitialState("auto-battle", config.gameType)
  state.sides.p1.name = config.team1Name || "Team 1"
  state.sides.p2.name = config.team2Name || "Team 2"

  const team1Packed = pasteToPackedTeam(config.team1Paste)
  const team2Packed = pasteToPackedTeam(config.team2Paste)
  if (!team1Packed || !team2Packed) {
    throw new Error("Failed to parse team pastes")
  }

  let protocolLog = ""
  const turnActions: SingleBattleResult["turnActions"] = []
  let pendingP1Actions: BattleActionSet | null = null
  let pendingP2Actions: BattleActionSet | null = null
  let pendingP1Slot2Actions: BattleActionSet | null = null
  let pendingP2Slot2Actions: BattleActionSet | null = null
  let p1TeamPreview = false
  let p2TeamPreview = false
  let lastProtocolChunk = ""
  const isDoubles = config.gameType === "doubles"

  function deduplicateAndProcess(proto: string) {
    const trimmed = proto.trim()
    if (!trimmed || trimmed === lastProtocolChunk) return
    lastProtocolChunk = trimmed
    protocolLog += proto
    processChunk(state, proto)
  }

  const outputPromise = (async () => {
    for await (const chunk of stream) {
      const lines = chunk.split("\n")
      let protoLines = ""

      for (const line of lines) {
        if (line.startsWith(REQUEST_PREFIX)) {
          deduplicateAndProcess(protoLines)
          protoLines = ""

          try {
            const reqJson = line.slice(REQUEST_PREFIX_LEN)
            const parsed = parseRequest(reqJson)
            const rawReq = JSON.parse(reqJson)
            const sideId = rawReq.side?.id as "p1" | "p2" | undefined
            if (!sideId) continue

            if (parsed.side) {
              updateSideFromRequest(state, sideId, parsed.side)
            }

            if (parsed.teamPreview) {
              if (sideId === "p1") p1TeamPreview = true
              else p2TeamPreview = true
            } else if (!parsed.wait && parsed.actions) {
              if (sideId === "p1") {
                pendingP1Actions = parsed.actions
                if (isDoubles) pendingP1Slot2Actions = parseRequestForSlot(reqJson, 1).actions
              } else {
                pendingP2Actions = parsed.actions
                if (isDoubles) pendingP2Slot2Actions = parseRequestForSlot(reqJson, 1).actions
              }
            }
          } catch {
            // Skip bad requests
          }
          continue
        }
        if (STREAM_MARKER_RE.test(line)) continue
        protoLines += line + "\n"
      }

      deduplicateAndProcess(protoLines)
    }
  })()

  // Start the battle
  const format = config.simFormatId || config.formatId || DEFAULT_FORMAT_ID
  const startSpec: Record<string, unknown> = { formatid: format }
  if (config.seed) startSpec.seed = config.seed
  stream.write(`>start ${JSON.stringify(startSpec)}`)
  stream.write(`>player p1 {"name":"${state.sides.p1.name}","team":"${escapeTeam(team1Packed)}"}`)
  stream.write(`>player p2 {"name":"${state.sides.p2.name}","team":"${escapeTeam(team2Packed)}"}`)

  await tick()

  if (p1TeamPreview) {
    stream.write(`>p1 team ${config.ai1.chooseLeads(6, config.gameType).join("")}`)
  }
  if (p2TeamPreview) {
    stream.write(`>p2 team ${config.ai2.chooseLeads(6, config.gameType).join("")}`)
  }

  await tick()

  // Main battle loop
  let turns = 0
  while (state.phase !== "ended" && turns < maxTurns) {
    await tick()

    if (pendingP1Actions && pendingP2Actions) {
      const p1Choice = await resolvePlayerChoice(
        config.ai1,
        state,
        pendingP1Actions,
        pendingP1Slot2Actions,
        isDoubles,
      )
      const p2Choice = await resolvePlayerChoice(
        config.ai2,
        state,
        pendingP2Actions,
        pendingP2Slot2Actions,
        isDoubles,
      )

      stream.write(`>p1 ${p1Choice}`)
      stream.write(`>p2 ${p2Choice}`)
      turnActions.push({ turn: state.turn, p1: p1Choice, p2: p2Choice })

      pendingP1Actions = null
      pendingP2Actions = null
      pendingP1Slot2Actions = null
      pendingP2Slot2Actions = null
      turns++
    } else if (pendingP1Actions?.forceSwitch) {
      const choice = await resolvePlayerChoice(
        config.ai1,
        state,
        pendingP1Actions,
        pendingP1Slot2Actions,
        isDoubles,
      )
      stream.write(`>p1 ${choice}`)
      pendingP1Actions = null
      pendingP1Slot2Actions = null
    } else if (pendingP2Actions?.forceSwitch) {
      const choice = await resolvePlayerChoice(
        config.ai2,
        state,
        pendingP2Actions,
        pendingP2Slot2Actions,
        isDoubles,
      )
      stream.write(`>p2 ${choice}`)
      pendingP2Actions = null
      pendingP2Slot2Actions = null
    }

    await tick()
  }

  // Cleanup
  try {
    stream.destroy()
  } catch {
    /* ok */
  }
  await outputPromise.catch(() => {})

  const winner = state.winner === "p1" ? "p1" : state.winner === "p2" ? "p2" : "draw"

  return {
    winner,
    turnCount: state.turn,
    protocolLog,
    team1Paste: config.team1Paste,
    team2Paste: config.team2Paste,
    turnActions,
    finalState: state,
  }
}

async function resolvePlayerChoice(
  ai: AIPlayer,
  state: BattleState,
  actions: BattleActionSet,
  slot2Actions: BattleActionSet | null,
  isDoubles: boolean,
): Promise<string> {
  const action1 = await ai.chooseAction(state, actions)
  const choice1 = actionToChoice(action1)

  if (!isDoubles || !slot2Actions) return choice1

  // If slot1 chose a switch, remove that Pokemon from slot2's options
  // to prevent "can only switch in once" errors when both slots faint
  if (action1.type === "switch") {
    slot2Actions = {
      ...slot2Actions,
      switches: slot2Actions.switches.filter((s) => s.index !== action1.pokemonIndex),
    }
  }
  const action2 = await ai.chooseAction(state, slot2Actions)
  return `${choice1}, ${actionToChoice(action2)}`
}

function actionToChoice(action: BattleAction): string {
  if (action.type === "move") {
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

function pasteToPackedTeam(paste: string): string | null {
  const trimmed = paste.trim()
  if (!trimmed) return null
  if (isAlreadyPacked(trimmed)) return trimmed
  try {
    const sets = Teams.import(trimmed)
    if (!sets || sets.length === 0) return null
    return Teams.pack(sets)
  } catch {
    return null
  }
}

function isAlreadyPacked(text: string): boolean {
  return !text.includes("\n") || (text.includes("|") && !text.includes("Ability:"))
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
