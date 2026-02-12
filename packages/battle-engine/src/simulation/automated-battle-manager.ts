import { BattleStreams, Teams } from "@pkmn/sim"
import {
  processChunk,
  parseRequest,
  parseRequestForSlot,
  updateSideFromRequest,
} from "../protocol-parser"
import { createInitialState } from "../battle-manager"
import { DEFAULT_FORMAT_ID, type GameType } from "@nasty-plot/core"
import type { BattleState, BattleActionSet, AIPlayer } from "../types"

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

  let protocolLog = ""
  const turnActions: SingleBattleResult["turnActions"] = []
  let currentTurnP1 = ""
  let currentTurnP2 = ""

  let pendingP1Actions: BattleActionSet | null = null
  let pendingP2Actions: BattleActionSet | null = null
  let pendingP1Slot2Actions: BattleActionSet | null = null
  let pendingP2Slot2Actions: BattleActionSet | null = null
  let p1TeamPreview = false
  let p2TeamPreview = false
  let lastProtocolChunk = ""
  const isDoubles = config.gameType === "doubles"
  let _lastP1ReqJson = ""
  let _lastP2ReqJson = ""

  // Convert pastes to packed format
  const team1Packed = pasteToPackedTeam(config.team1Paste)
  const team2Packed = pasteToPackedTeam(config.team2Paste)

  if (!team1Packed || !team2Packed) {
    throw new Error("Failed to parse team pastes")
  }

  // Collect and process output
  const outputPromise = (async () => {
    for await (const chunk of stream) {
      const lines = chunk.split("\n")
      let protoLines = ""

      for (const line of lines) {
        if (line.startsWith("|request|")) {
          // Process accumulated protocol (deduplicated — sim emits for both players)
          if (protoLines.trim() && protoLines.trim() !== lastProtocolChunk) {
            lastProtocolChunk = protoLines.trim()
            protocolLog += protoLines
            processChunk(state, protoLines)
          }
          protoLines = ""

          // Parse request
          try {
            const reqJson = line.slice(9)
            const parsed = parseRequest(reqJson)
            const rawReq = JSON.parse(reqJson)
            const sideId = rawReq.side?.id as "p1" | "p2" | undefined

            if (sideId && parsed.side) {
              updateSideFromRequest(state, sideId, parsed.side)
            }

            if (sideId === "p1") {
              if (parsed.teamPreview) {
                p1TeamPreview = true
              } else if (!parsed.wait && parsed.actions) {
                pendingP1Actions = parsed.actions
                if (isDoubles) {
                  _lastP1ReqJson = reqJson
                  const slot2 = parseRequestForSlot(reqJson, 1)
                  pendingP1Slot2Actions = slot2.actions
                }
              }
            } else if (sideId === "p2") {
              if (parsed.teamPreview) {
                p2TeamPreview = true
              } else if (!parsed.wait && parsed.actions) {
                pendingP2Actions = parsed.actions
                if (isDoubles) {
                  _lastP2ReqJson = reqJson
                  const slot2 = parseRequestForSlot(reqJson, 1)
                  pendingP2Slot2Actions = slot2.actions
                }
              }
            }
          } catch {
            // Skip bad requests
          }
          continue
        }
        // Skip stream markers that differ per player and break deduplication
        if (line === "update" || line === "sideupdate" || /^p[1-4]$/.test(line)) {
          continue
        }
        protoLines += line + "\n"
      }

      // Process remaining (deduplicated)
      if (protoLines.trim() && protoLines.trim() !== lastProtocolChunk) {
        lastProtocolChunk = protoLines.trim()
        protocolLog += protoLines
        processChunk(state, protoLines)
      }
    }
  })()

  // Start the battle
  const format = config.simFormatId || config.formatId || DEFAULT_FORMAT_ID
  const startSpec: Record<string, unknown> = { formatid: format }
  if (config.seed) startSpec.seed = config.seed
  stream.write(`>start ${JSON.stringify(startSpec)}`)
  stream.write(`>player p1 {"name":"${state.sides.p1.name}","team":"${escapeTeam(team1Packed)}"}`)
  stream.write(`>player p2 {"name":"${state.sides.p2.name}","team":"${escapeTeam(team2Packed)}"}`)

  // Wait for requests
  await tick()

  // Handle team preview
  if (p1TeamPreview) {
    const p1Leads = config.ai1.chooseLeads(6, config.gameType)
    stream.write(`>p1 team ${p1Leads.join("")}`)
  }
  if (p2TeamPreview) {
    const p2Leads = config.ai2.chooseLeads(6, config.gameType)
    stream.write(`>p2 team ${p2Leads.join("")}`)
  }

  await tick()

  // Main battle loop
  let turns = 0
  while (state.phase !== "ended" && turns < maxTurns) {
    await tick()

    await processActions()

    async function processActions() {
      if (pendingP1Actions && pendingP2Actions) {
        if (isDoubles) {
          // Doubles: get actions for both slots of each player
          const p1a1 = await config.ai1.chooseAction(state, pendingP1Actions)
          let p1Choice = actionToChoice(p1a1)
          if (pendingP1Slot2Actions) {
            const p1a2 = await config.ai1.chooseAction(state, pendingP1Slot2Actions)
            p1Choice = `${p1Choice}, ${actionToChoice(p1a2)}`
          }

          const p2a1 = await config.ai2.chooseAction(state, pendingP2Actions)
          let p2Choice = actionToChoice(p2a1)
          if (pendingP2Slot2Actions) {
            const p2a2 = await config.ai2.chooseAction(state, pendingP2Slot2Actions)
            p2Choice = `${p2Choice}, ${actionToChoice(p2a2)}`
          }

          currentTurnP1 = p1Choice
          currentTurnP2 = p2Choice
        } else {
          const p1Action = await config.ai1.chooseAction(state, pendingP1Actions)
          const p2Action = await config.ai2.chooseAction(state, pendingP2Actions)
          currentTurnP1 = actionToChoice(p1Action)
          currentTurnP2 = actionToChoice(p2Action)
        }

        stream.write(`>p1 ${currentTurnP1}`)
        stream.write(`>p2 ${currentTurnP2}`)

        turnActions.push({ turn: state.turn, p1: currentTurnP1, p2: currentTurnP2 })

        pendingP1Actions = null
        pendingP2Actions = null
        pendingP1Slot2Actions = null
        pendingP2Slot2Actions = null
        turns++
        return
      }
      if (pendingP1Actions && pendingP1Actions.forceSwitch) {
        if (isDoubles && pendingP1Slot2Actions) {
          const p1a1 = await config.ai1.chooseAction(state, pendingP1Actions)
          const p1a2 = await config.ai1.chooseAction(state, pendingP1Slot2Actions)
          stream.write(`>p1 ${actionToChoice(p1a1)}, ${actionToChoice(p1a2)}`)
          pendingP1Slot2Actions = null
        } else {
          const p1Action = await config.ai1.chooseAction(state, pendingP1Actions)
          stream.write(`>p1 ${actionToChoice(p1Action)}`)
        }
        pendingP1Actions = null
        return
      }
      if (pendingP2Actions && pendingP2Actions.forceSwitch) {
        if (isDoubles && pendingP2Slot2Actions) {
          const p2a1 = await config.ai2.chooseAction(state, pendingP2Actions)
          const p2a2 = await config.ai2.chooseAction(state, pendingP2Slot2Actions)
          stream.write(`>p2 ${actionToChoice(p2a1)}, ${actionToChoice(p2a2)}`)
          pendingP2Slot2Actions = null
        } else {
          const p2Action = await config.ai2.chooseAction(state, pendingP2Actions)
          stream.write(`>p2 ${actionToChoice(p2Action)}`)
        }
        pendingP2Actions = null
      }
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

function actionToChoice(action: {
  type: string
  moveIndex?: number
  pokemonIndex?: number
  tera?: boolean
  targetSlot?: number
  mega?: boolean
}): string {
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

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
