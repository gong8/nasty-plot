# Session: Doubles Simultaneous Faint Switch Bug

**Date:** 2026-02-13
**Duration context:** short

## What was accomplished

- Fixed a bug where doubles battles with bots would crash when both Pokemon on one side fainted simultaneously
- Identified and fixed the same bug in both `battle-manager.ts` (live battles) and `automated-battle-manager.ts` (batch simulations)

## Key decisions & rationale

- Fixed at the caller level (`handleAIForceSwitchDoubles` / `resolvePlayerChoice`) rather than at the AI player level. This is the simplest and most correct place — after slot1's choice is made, filter its switch target from slot2's options before asking the AI. This avoids needing every AI implementation to track "reserved" Pokemon.

## Bugs found & fixed

- **Doubles simultaneous faint crash:** When both active Pokemon on one side faint in the same turn during a doubles battle, the code asks the AI for two switch-in choices independently. Both calls receive the same list of available switches, so both can pick the same Pokemon. When `@pkmn/sim` receives `switch 4, switch 4`, it rejects with: `[Invalid choice] Can't switch: The Pokémon in slot 4 can only switch in once`.
  - **Root cause:** `handleAIForceSwitchDoubles` and `resolvePlayerChoice` called `ai.chooseAction()` twice with identical switch pools, with no deduplication.
  - **Fix:** After getting slot1's switch choice, filter that `pokemonIndex` from `slot2Actions.switches` before requesting slot2's choice.

## Pitfalls & gotchas encountered

- The bug exists in two separate files (`battle-manager.ts` for interactive battles and `automated-battle-manager.ts` for batch simulations) with nearly identical logic — easy to fix one and miss the other.
- Existing test coverage mocks the AI to return different Pokemon (index 3 then 4), so the collision case was never tested. The test passes but doesn't exercise the actual bug scenario.

## Files changed

- `packages/battle-engine/src/battle-manager.ts` — added switch deduplication in `handleAIForceSwitchDoubles` (around line 793)
- `packages/battle-engine/src/simulation/automated-battle-manager.ts` — added switch deduplication in `resolvePlayerChoice` (around line 225)

## Known issues & next steps

- No test specifically exercises the collision scenario (both slots picking the same Pokemon). A targeted test should mock the AI to always return the first available switch, then verify the second slot gets a different Pokemon.
- Pre-existing test failures (22 test files) unrelated to this change — caused by a missing `@nasty-plot/formats/db` export. These appear to be from the in-progress SSOT deduplication refactor on the current branch.

## Tech notes

- `@pkmn/sim` validates switch choices strictly — a Pokemon can only appear in one switch slot per turn. The error message references the 1-indexed team slot number.
- `BattleActionSet.switches` contains `{ index, name, speciesId, hp, ... }` where `index` is the 1-indexed team position. Filtering by `index !== action1.pokemonIndex` correctly removes the chosen Pokemon.
- The `extractSwitches` function (in `protocol-parser.ts`) already filters out fainted and active Pokemon, so the switch list only contains valid candidates. The only issue was duplicate selection across slots.
