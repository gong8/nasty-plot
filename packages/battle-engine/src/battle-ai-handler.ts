import type { BattleState, AIPlayer, BattleActionSet } from "./types"

/** Simulate AI "thinking" with a randomized delay for realism. */
function aiThinkDelay(baseMs: number, jitterMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, baseMs + Math.random() * jitterMs))
}

function actionToChoice(action: {
  type: string
  moveIndex?: number
  targetSlot?: number
  tera?: boolean
  mega?: boolean
  pokemonIndex?: number
}): string {
  if (action.type === "move") {
    let choice = `move ${action.moveIndex}`
    if (action.targetSlot != null) choice += ` ${action.targetSlot}`
    if (action.tera) choice += " terastallize"
    if (action.mega) choice += " mega"
    return choice
  }
  return `switch ${action.pokemonIndex}`
}

/** Build a doubles choice string where only one slot acts and the other passes. */
function buildPartialDoublesChoice(actionStr: string, activeSlot: number): string {
  return activeSlot === 0 ? `${actionStr}, pass` : `pass, ${actionStr}`
}

export interface AIHandlerContext {
  ai: AIPlayer
  state: BattleState
  pendingP2Actions: BattleActionSet | null
  pendingP2Slot2Actions: BattleActionSet | null
  stream: { write(data: string): void }
  getSerializedBattle: () => unknown | null
  formatId: string
}

/**
 * Handle the AI's turn — pick an action (and a second for doubles) and submit to the stream.
 * Returns updated pending action state.
 */
export async function handleAITurn(ctx: AIHandlerContext): Promise<{
  pendingP2Actions: BattleActionSet | null
  pendingP2Slot2Actions: BattleActionSet | null
}> {
  if (!ctx.ai || !ctx.pendingP2Actions) {
    return {
      pendingP2Actions: ctx.pendingP2Actions,
      pendingP2Slot2Actions: ctx.pendingP2Slot2Actions,
    }
  }

  await aiThinkDelay(300, 700)
  syncMCTSBattleState(ctx.ai, ctx.getSerializedBattle, ctx.formatId)

  const action1 = await ctx.ai.chooseAction(ctx.state, ctx.pendingP2Actions)
  let choice: string

  if (ctx.state.gameType === "doubles" && ctx.pendingP2Slot2Actions) {
    const action2 = await ctx.ai.chooseAction(ctx.state, ctx.pendingP2Slot2Actions)
    choice = `${actionToChoice(action1)}, ${actionToChoice(action2)}`
    console.log("[BattleManager] p2 AI doubles choice:", choice)
  } else {
    choice = actionToChoice(action1)
    console.log("[BattleManager] p2 AI choice:", choice)
  }

  ctx.stream.write(`>p2 ${choice}`)
  return { pendingP2Actions: null, pendingP2Slot2Actions: null }
}

/**
 * Handle AI force switch in singles.
 */
export async function handleAIForceSwitch(
  ai: AIPlayer,
  state: BattleState,
  actions: BattleActionSet,
  stream: { write(data: string): void },
): Promise<void> {
  await aiThinkDelay(200, 300)
  const aiAction = await ai.chooseAction(state, actions)
  stream.write(`>p2 ${actionToChoice(aiAction)}`)
}

/**
 * Handle AI force switch in doubles — both slots may need to switch.
 */
export async function handleAIForceSwitchDoubles(
  ai: AIPlayer,
  state: BattleState,
  slot1Actions: BattleActionSet,
  slot2Actions: BattleActionSet | null,
  stream: { write(data: string): void },
): Promise<void> {
  await aiThinkDelay(200, 300)
  const action1 = await ai.chooseAction(state, slot1Actions)

  if (slot2Actions) {
    // If slot1 chose a switch, remove that Pokemon from slot2's options
    // to prevent "can only switch in once" errors when both slots faint
    if (action1.type === "switch") {
      slot2Actions = {
        ...slot2Actions,
        switches: slot2Actions.switches.filter((s) => s.index !== action1.pokemonIndex),
      }
    }
    const action2 = await ai.chooseAction(state, slot2Actions)
    const choice = `${actionToChoice(action1)}, ${actionToChoice(action2)}`
    console.log("[BattleManager] p2 AI doubles forceSwitch:", choice)
    stream.write(`>p2 ${choice}`)
  } else {
    const choice = buildPartialDoublesChoice(actionToChoice(action1), slot1Actions.activeSlot ?? 0)
    console.log("[BattleManager] p2 AI doubles partial forceSwitch:", choice)
    stream.write(`>p2 ${choice}`)
  }
}

/**
 * Pass serialized battle state to MCTS AI if it supports setBattleState.
 */
export function syncMCTSBattleState(
  ai: AIPlayer,
  getSerializedBattle: () => unknown | null,
  formatId: string,
): void {
  const castAi = ai as { setBattleState?: (json: unknown, fmt?: string) => void }
  if (typeof castAi.setBattleState !== "function") return

  const serialized = getSerializedBattle()
  if (serialized) {
    castAi.setBattleState(serialized, formatId)
  }
}
