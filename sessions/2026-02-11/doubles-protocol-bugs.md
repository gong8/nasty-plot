# Session: Doubles Protocol & State Bugs

**Date:** 2026-02-11
**Duration context:** Medium

## What was accomplished

- Fixed 3 interconnected bugs in the doubles battle engine related to protocol parsing, stale AI state, and error-handling timing

## Key decisions & rationale

- **Stream marker filtering approach:** Matched the existing pattern from `replay-engine.ts` (line 58) which already skips `update`, `sideupdate`, `p1`, `p2` lines. Applied the same logic to `battle-manager.ts` and `automated-battle-manager.ts` for consistency.
- **Stale state reset location:** Chose to reset `pendingP2Actions` and `pendingP2Slot2Actions` at the top of every p2 request handler, rather than guarding in `handleAITurn`. Resetting at the source prevents any future code path from accidentally using stale values.
- **Pending error pattern:** Added a `pendingError` field rather than restructuring the async flow, since the timing issue (error arriving before `waitForUpdate` registers) is inherent to the `handleAITurn` delay.

## Bugs found & fixed

### Bug 1: Duplicated berry consumption messages

- **Symptom:** "Slowbro's Colbur Berry was consumed!" appeared twice in doubles battle log
- **Root cause:** `@pkmn/sim`'s `BattleStream` emits protocol twice per turn (once per player's `|request|`). The deduplication in `processOutput` compared accumulated protocol strings, but bare metadata lines (`update`, `sideupdate`, `p1`/`p2`) were included in the accumulation. These differ between the two emissions (`sideupdate\np1` vs `sideupdate\np2`), causing the string comparison to fail. Every battle event got processed twice.
- **Fix:** Skip `update`, `sideupdate`, and `/^p[1-4]$/` lines during protocol accumulation in both `battle-manager.ts` and `automated-battle-manager.ts`.

### Bug 2: "You sent more choices than unfainted Pokemon"

- **Symptom:** Console error `[Invalid choice] Can't move: You sent more choices than unfainted Pokemon.` in doubles battles
- **Root cause:** `pendingP2Slot2Actions` was never cleared between turns. When p2's request came in as a `forceSwitch` (one Pokemon fainted), the forceSwitch branch handled the switch but left stale slot 2 actions from the previous turn. On the next turn, `handleAITurn` saw non-null `pendingP2Slot2Actions` and sent 2 choices for only 1 alive Pokemon.
- **Fix:** Reset both `pendingP2Actions` and `pendingP2Slot2Actions` to `null` at the start of every p2 request in `handleRequest`.

### Bug 3: `waitForUpdate` 15-second timeout

- **Symptom:** Console error `[BattleManager] waitForUpdate timed out after 15s`
- **Root cause:** Cascade from Bug 2. When the sim rejected the invalid choice, it sent an `|error|` response. But the error arrived during `handleAITurn`'s async delay (300-1000ms), before `waitForUpdate` registered its `resolveReady` callback. The error was logged but `resolveReady` was null, so nobody was listening. Then `waitForUpdate` waited for output that would never come.
- **Fix:** Added `pendingError` field. If an error arrives before `waitForUpdate` is called, it's stored. `waitForUpdate` checks for pending errors immediately and resolves without waiting.

## Pitfalls & gotchas encountered

- **`@pkmn/sim` BattleStream protocol format:** The raw omniscient stream includes `update`, `sideupdate`, and player ID lines (`p1`, `p2`) as bare text (no `|` prefix). These are NOT protocol events but stream-level markers. The `replay-engine.ts` already knew this, but `battle-manager.ts` and `automated-battle-manager.ts` didn't skip them.
- **`continue` in `for` loops:** When analyzing the `|split|` handler's `i += 2; continue`, it's important to remember that `continue` in a `for` loop DOES execute the update expression (`i++`), so the total skip is 3 positions — which is correct behavior.
- **Async timing in BattleManager:** The `handleAITurn` delay (for realism) creates a window where stream errors can arrive before `waitForUpdate` is called. Any code adding similar delays needs to account for this.

## Files changed

- `packages/battle-engine/src/battle-manager.ts` — skip stream markers, reset stale p2 state, pending error handling
- `packages/battle-engine/src/simulation/automated-battle-manager.ts` — skip stream markers

## Known issues & next steps

- 3 pre-existing test failures in `tests/llm/chat.service.test.ts` (unrelated to battle engine)
- The `handleAIForceSwitchDoubles` sends `pass` for the non-switching slot — should verify this is always valid when a slot has fainted with no replacement vs. when a slot is alive and doesn't need to switch
- Consider adding integration tests for doubles scenarios with mid-turn faints and no replacements

## Tech notes

- **`BattleStream` output format:** Each turn's output includes the protocol (public events + `|split|` blocks) followed by per-player `|sideupdate|` + `|request|` pairs. The protocol portion is identical for both players, but the `sideupdate`/player-ID lines differ.
- **Deduplication mechanism:** `lastProtocolChunk` stores the trimmed accumulated protocol. When the same protocol appears before the second `|request|`, it's skipped. This only works correctly when stream markers are excluded from accumulation.
- **`pendingP2Actions` / `pendingP2Slot2Actions` lifecycle:** These are set when p2's request arrives (non-forceSwitch, non-wait), consumed when `handleAITurn` runs, and now reset at the start of every p2 request to prevent stale values.
