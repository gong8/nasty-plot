# Session: Doubles Targeting & Battle Flow Fixes

**Date:** 2026-02-11
**Duration context:** Long (continuation from a previous context-exhausted session)

## What was accomplished

### AI Target Slot Convention Fix

- Fixed all AI players (GreedyAI, HeuristicAI, hint-engine) that were using **negative** numbers (`-(t+1)`) for foe targeting. `@pkmn/sim` expects **positive** numbers (`1`, `2`) for foe slots. Negative numbers are self/ally slots.
- Fixed `battle-cloner.ts` `getLegalChoices()` to emit `move X 1` / `move X 2` instead of `move X -1` / `move X -2`
- Updated MCTS AI comment (MCTS parses from battle-cloner choices, so it was implicitly fixed)

### Target Selection Modal (MoveSelector rewrite)

- Replaced inline target buttons (below the move) with a **Dialog modal** containing a **2x2 battlefield grid**
- Each slot shows: Pokemon sprite (via `BattleSprite`), name, HP bar (green/yellow/red), type badges
- "You" badge on the active Pokemon using the move
- Foe slots have red borders/hover, ally/self slots have blue
- Non-selectable slots are dimmed based on move target type
- Correct target type handling for all Showdown move targets:
  - `normal`: foe1, foe2, ally
  - `adjacentFoe`: foe1, foe2
  - `any`: foe1, foe2, ally, self
  - `adjacentAlly`: auto-resolved (single valid target, no modal)
  - `adjacentAllyOrSelf`: self, ally
- Props changed from string names (`opponentNames`, `allyName`, `selfName`) to full `BattlePokemon` arrays (`opponentActive`, `playerActive`)

### Doubles Combined Choice Fix

- Fixed `BattleManager.submitAction` to handle doubles correctly — `@pkmn/sim` requires combined choices for both active slots (e.g., `move 1 1, move 2 2`)
- First `submitAction` call stores slot-0 action, swaps `availableActions` to slot-1's moves, fires UI update
- Second `submitAction` call combines both and sends to sim
- Added `pendingP1Slot1Action` field to BattleManager with proper reset on new turn

### Choice Format Order Fix

- `actionToChoice` was putting `terastallize`/`mega` **before** the target slot
- `@pkmn/sim` expects: `move [index] [target] [modifier]`
- Fixed in both `battle-manager.ts` and `automated-battle-manager.ts`

### Test Updates

- Updated `battle-cloner.test.ts` expectations: `move 1 -1` -> `move 1 1`, `move 1 -2` -> `move 1 2`
- Updated `doubles-ai.test.ts`: `toBeLessThan(0)` -> `toBeGreaterThan(0)`, updated combined choice string tests
- All 64 battle-engine test files pass (3 pre-existing LLM test failures unrelated)

## Key decisions & rationale

- **Modal over inline buttons**: The inline target buttons were confusing and took up space below each move. A modal with a 2x2 grid mirrors the actual battlefield layout, making it intuitive to pick a target.
- **Full BattlePokemon props**: Passing full Pokemon objects instead of just names gives the modal access to sprites, HP, types — much richer targeting UI.
- **Two-step submitAction for doubles**: Rather than requiring the UI/hook layer to call a different method (`submitDoubleActions`), the existing `submitAction` was made smart enough to handle doubles internally. This keeps the `use-battle.ts` hook unchanged.
- **Auto-resolve adjacentAlly**: Since there's exactly one ally in doubles, moves like Helping Hand skip the modal entirely.

## Bugs found & fixed

1. **AI targeting with wrong slot signs** — All AI players used `-(t+1)` for foe targeting. In `@pkmn/sim`, positive slots (1, 2) = foes, negative (-1, -2) = self/ally. AIs were accidentally targeting allies or causing errors.

2. **"Incomplete choice: move 2 2 - missing other pokemon"** — `submitAction` sent a single-slot choice in doubles, but `@pkmn/sim` expects both active Pokemon's choices combined with a comma. Root cause: `submitDoubleActions` existed but was never called from the UI flow.

3. **Choice format order** — `move 1 terastallize 2` is wrong; sim expects `move 1 2 terastallize`. Target slot must come before modifiers.

## Pitfalls & gotchas encountered

- **`@pkmn/sim` target slot convention is counterintuitive**: Positive numbers are foes, negative are allies/self. This is the opposite of what you'd expect (positive = "my side"). Empirically verified by running actual battles through BattleStream.
- **Target numbering is absolute, not relative to acting slot**: From either active slot (0 or 1), foe slot 1 is always p2a and foe slot 2 is always p2b. Self/ally slots depend on which slot is acting: slot 0's self is -1, slot 0's ally is -2; slot 1's self is -2, slot 1's ally is -1.
- **Doubles requires combined choices**: You can't send `>p1 move 1 1` then `>p1 move 2 2` separately. Must be `>p1 move 1 1, move 2 2` in a single write.

## Files changed

**Modified:**

- `packages/battle-engine/src/ai/greedy-ai.ts` — Fixed foe target slot: `-(t+1)` -> `t+1`
- `packages/battle-engine/src/ai/heuristic-ai.ts` — Fixed foe target slot: `-(t+1)` -> `t+1`
- `packages/battle-engine/src/ai/battle-cloner.ts` — Fixed choice strings: `-1`/`-2` -> `1`/`2`
- `packages/battle-engine/src/ai/hint-engine.ts` — Fixed foe target slot: `-(t+1)` -> `t+1`
- `packages/battle-engine/src/ai/mcts-ai.ts` — Updated comment only
- `packages/battle-engine/src/battle-manager.ts` — Added `pendingP1Slot1Action`, rewrote `submitAction` for doubles, fixed `actionToChoice` order
- `packages/battle-engine/src/simulation/automated-battle-manager.ts` — Fixed `actionToChoice` order
- `apps/web/src/features/battle/components/MoveSelector.tsx` — Complete rewrite: Dialog modal with 2x2 grid, new props (`opponentActive`, `playerActive`), all target types, `TargetCard` component
- `apps/web/src/features/battle/components/BattleView.tsx` — Pass `opponentActive`/`playerActive` arrays to MoveSelector
- `tests/battle-engine/battle-cloner.test.ts` — Updated expectations for positive foe slots
- `tests/battle-engine/doubles-ai.test.ts` — Updated expectations for positive foe slots and combined choice strings

## Known issues & next steps

- **Doubles UI only shows one slot at a time**: The user picks moves for slot 0, then slot 1 sequentially. A side-by-side view showing both active Pokemon's move panels simultaneously could be better UX.
- **No visual indicator for "choosing for slot 2"**: When the MoveSelector swaps to the second Pokemon's moves, there's no header or label telling the user they're now picking for their second active Pokemon.
- **Spread move damage reduction**: In doubles, spread moves (Earthquake, Rock Slide) deal 75% damage. The AI damage calc doesn't account for this, so spread moves may be over-valued by GreedyAI/HeuristicAI.
- **Ally targeting for spread moves**: Earthquake hits your own ally — the AI doesn't penalize this when choosing Earthquake in doubles.
- **3 pre-existing LLM test failures** in `tests/llm/chat.service.test.ts` — unrelated to this session's work.

## Tech notes

### @pkmn/sim target slot convention

```
Positive slots = foe side:
  1 = p2a (left foe)
  2 = p2b (right foe)

Negative slots = own side (absolute, not relative):
  -1 = p1a (left ally / self if acting from slot 0)
  -2 = p1b (right ally / self if acting from slot 1)

From slot 0: self = -1, ally = -2
From slot 1: self = -2, ally = -1
```

### @pkmn/sim choice format

```
move [moveIndex] [targetSlot] [terastallize|mega]
```

Target slot comes BEFORE modifiers. Combined doubles: `move 1 1, move 2 2` (comma-separated, single write).

### Choosable target types (require user selection in doubles)

- `normal` — any adjacent (both foes + ally)
- `any` — any Pokemon on field (both foes + ally + self)
- `adjacentFoe` — either foe only
- `adjacentAlly` — ally only (auto-resolved, single target)
- `adjacentAllyOrSelf` — self or ally

### Non-choosable targets (auto-resolved by sim)

- `self` — always self
- `allAdjacent` — hits all adjacent including ally (e.g., Earthquake)
- `allAdjacentFoes` — hits all foes (e.g., Rock Slide)
- `all` — hits all Pokemon
