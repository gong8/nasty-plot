import { parseRequest, parseRequestForSlot, updateSideFromRequest } from "./protocol-parser.service"
import type { BattleState, BattleActionSet, BattleLogEntry, AIPlayer } from "./types"
import { handleAIForceSwitch, handleAIForceSwitchDoubles } from "./battle-ai-handler"

export type BattleEventHandler = (state: BattleState, entries: BattleLogEntry[]) => void

export interface RequestHandlerContext {
  state: BattleState
  ai: AIPlayer | null
  eventHandler: BattleEventHandler | null
  stream: { write(data: string): void }
  pendingP2Actions: BattleActionSet | null
  pendingP2Slot2Actions: BattleActionSet | null
  pendingP1Slot2Actions: BattleActionSet | null
  pendingP1Slot1Action: { type: string; moveIndex?: number } | null
  resolveWaiter: () => void
}

/**
 * Handle a p1 (player) request from the sim.
 * Mutates state and context pending actions, then resolves the waiter.
 */
export function handleP1Request(
  parsed: ReturnType<typeof parseRequest>,
  requestJson: string,
  isDoubles: boolean,
  ctx: RequestHandlerContext,
): {
  pendingP1Slot2Actions: BattleActionSet | null
  pendingP1Slot1Action: { type: string; moveIndex?: number } | null
} {
  if (parsed.side) {
    updateSideFromRequest(ctx.state, "p1", parsed.side)
  }

  // Reset pending slot-1 action on new request (new turn)
  let pendingP1Slot1Action: { type: string; moveIndex?: number } | null = null
  let pendingP1Slot2Actions: BattleActionSet | null = ctx.pendingP1Slot2Actions

  if (parsed.teamPreview) {
    ctx.state.phase = "preview"
    ctx.state.waitingForChoice = true
  } else if (parsed.wait) {
    ctx.state.waitingForChoice = false
    if (isDoubles) {
      console.log("[BattleManager] p1 received wait request")
    }
  } else {
    const result = applyP1Actions(parsed, requestJson, isDoubles, ctx.state)
    pendingP1Slot2Actions = result.pendingP1Slot2Actions
    pendingP1Slot1Action = result.pendingP1Slot1Action
  }

  ctx.eventHandler?.(ctx.state, [])
  ctx.resolveWaiter()

  return { pendingP1Slot2Actions, pendingP1Slot1Action }
}

/**
 * Set availableActions and pendingP1Slot2Actions from a parsed p1 request.
 */
export function applyP1Actions(
  parsed: ReturnType<typeof parseRequest>,
  requestJson: string,
  isDoubles: boolean,
  state: BattleState,
): {
  pendingP1Slot2Actions: BattleActionSet | null
  pendingP1Slot1Action: { type: string; moveIndex?: number } | null
} {
  let pendingP1Slot2Actions: BattleActionSet | null = null
  let pendingP1Slot1Action: { type: string; moveIndex?: number } | null = null

  if (isDoubles) {
    const slot2 = parseRequestForSlot(requestJson, 1)
    const slot0HasNoMoves =
      parsed.actions && !parsed.actions.forceSwitch && parsed.actions.moves.length === 0

    // If slot 0 has no moves and no forceSwitch but slot 1 needs to act
    // (e.g. forceSwitch: [false, true]), show slot 1's actions directly
    if (slot0HasNoMoves && slot2.actions) {
      pendingP1Slot1Action = { type: "move", moveIndex: 0 } // sentinel for "pass"
      state.availableActions = slot2.actions
      console.log("[BattleManager] p1 doubles: slot0 pass, showing slot1 forceSwitch")
    } else {
      state.availableActions = parsed.actions
      pendingP1Slot2Actions = slot2.actions
    }

    console.log(
      "[BattleManager] p1 request: slot0 moves=%d, slot1 actions=%s, forceSwitch=%s",
      parsed.actions?.moves.length ?? 0,
      slot2.actions ? `moves=${slot2.actions.moves.length}` : "null",
      parsed.actions?.forceSwitch ?? false,
    )
  } else {
    state.availableActions = parsed.actions
  }

  if (state.availableActions && state.sides.p1.hasTerastallized) {
    state.availableActions.canTera = false
  }
  state.waitingForChoice = true

  return { pendingP1Slot2Actions, pendingP1Slot1Action }
}

/**
 * Handle a p2 (opponent/AI) request from the sim.
 * Returns updated pending p2 action state.
 */
export async function handleP2Request(
  parsed: ReturnType<typeof parseRequest>,
  requestJson: string,
  isDoubles: boolean,
  ctx: RequestHandlerContext,
): Promise<{
  pendingP2Actions: BattleActionSet | null
  pendingP2Slot2Actions: BattleActionSet | null
}> {
  if (parsed.side) {
    updateSideFromRequest(ctx.state, "p2", parsed.side)
  }

  // Reset stale p2 pending actions on every new p2 request to prevent
  // sending choices for fainted Pokemon on subsequent turns.
  let pendingP2Actions: BattleActionSet | null = null
  let pendingP2Slot2Actions: BattleActionSet | null = null

  if (parsed.teamPreview || parsed.wait || !parsed.actions) {
    return { pendingP2Actions, pendingP2Slot2Actions }
  }

  // Only p2 needs to switch (p1 is waiting) — AI responds immediately
  if (parsed.actions.forceSwitch && ctx.ai && !ctx.state.waitingForChoice) {
    const slot2Actions = isDoubles ? parseRequestForSlot(requestJson, 1).actions : null
    if (isDoubles) {
      await handleAIForceSwitchDoubles(ctx.ai, ctx.state, parsed.actions, slot2Actions, ctx.stream)
    } else {
      await handleAIForceSwitch(ctx.ai, ctx.state, parsed.actions, ctx.stream)
    }
    return { pendingP2Actions, pendingP2Slot2Actions }
  }

  // Store for AI to use when player submits their action
  pendingP2Actions = parsed.actions
  if (ctx.state.sides.p2.hasTerastallized) {
    pendingP2Actions.canTera = false
  }

  if (isDoubles) {
    pendingP2Slot2Actions = parseRequestForSlot(requestJson, 1).actions
    console.log(
      "[BattleManager] p2 request: slot0 moves=%d, slot1=%s",
      parsed.actions.moves.length,
      pendingP2Slot2Actions ? `moves=${pendingP2Slot2Actions.moves.length}` : "null",
    )
  }

  return { pendingP2Actions, pendingP2Slot2Actions }
}
