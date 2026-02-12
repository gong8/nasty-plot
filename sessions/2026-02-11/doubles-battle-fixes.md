# Session: Doubles Battle Fixes

**Date:** 2026-02-11
**Duration context:** Long (continued from a compacted session)

## What was accomplished

- Fixed move type box text readability — light-colored type backgrounds (Fairy, Electric, Normal) now use dark text via luminance calculation
- Restructured MoveSelector to 2x3 grid: 4 moves in rows 1-2, Switch + Tera toggle in row 3
- Replaced per-move tera sparkle icons with a single global Tera toggle button next to Switch
- Fixed "Can only Terastallize once per battle" error — tera button now disables after use
- Fixed 6 bugs in the doubles battle flow that caused "stuck on Waiting for opponent..." after submitting both moves
- Added comprehensive diagnostic logging for doubles battle flow

## Key decisions & rationale

- **Tera as global toggle vs per-move:** Moved from per-move sparkle icons to a single checkbox-style toggle button. Cleaner UX and matches how tera works in the games (it's a decision for the turn, not per-move).
- **Luminance threshold of 0.55:** Uses `(0.299*R + 0.587*G + 0.114*B) / 255` for perceived brightness. Light types get `text-gray-900` with `border-black/10`, dark types get `text-white` with `border-white/20`.
- **Safety timeout on waitForUpdate (15s):** Prevents permanent UI freeze even if unknown edge cases exist. Logs a clear error message when triggered.
- **Error resolution only during battle phase:** Sim errors during `start()` are handled by the existing 10s timeout. Mid-battle errors now resolve `resolveReady` to prevent hangs.

## Bugs found & fixed

### 1. Move type text unreadable on light backgrounds

- **Symptom:** White text on Fairy pink, Electric yellow, Normal beige backgrounds
- **Fix:** Added `isLightColor()` helper in MoveSelector.tsx using luminance calculation, conditionally applies dark text

### 2. Tera "once per battle" error

- **Symptom:** Error thrown when clicking tera after already terastallizing
- **Root cause:** `teraActive` local state persisted even after `canTera` prop became false
- **Fix:** `useEffect` resets `teraActive` when `canTera` is false; safety gate `useTera = teraActive && canTera` in click handler

### 3. `readStream` silently swallowed errors (battle-manager.ts:298-306)

- **Symptom:** If `processOutput` threw during doubles protocol processing, the stream reader died and all future updates were lost
- **Fix:** Wrapped `processOutput` call in try/catch inside the loop; added error logging to outer catch

### 4. Sim errors caused permanent hangs (battle-manager.ts:332-337)

- **Symptom:** When `@pkmn/sim` rejected a choice (invalid target, etc.), it sent `|error|` but no `|request|`. `waitForUpdate` hung forever.
- **Fix:** On error during battle phase, resolve `resolveReady` so the flow continues

### 5. `parseRequest` treated doubles `forceSwitch` array as truthy (protocol-parser.ts:783)

- **Symptom:** `forceSwitch: [false, true]` (only slot 1 KO'd) entered forceSwitch branch because arrays are truthy in JS
- **Fix:** Now checks `forceArr[0]` specifically; falls through to normal extraction if slot 0 doesn't need to switch

### 6. Missing `pass` for non-switching slots in doubles forceSwitch (battle-manager.ts)

- **Symptom:** Sent `switch 3` instead of `switch 3, pass` — sim expected both slots' actions
- **Fix:** Added `pass` insertion for player and AI in partial forceSwitch scenarios

### 7. `extractSwitches` included active Pokemon (protocol-parser.ts:921-938)

- **Symptom:** In doubles, switch list included already-active Pokemon. Sim rejects switching to an active Pokemon.
- **Fix:** Added `!p.active` filter alongside `!p.fainted`

### 8. Doubles `forceSwitch: [false, true]` showed empty UI (battle-manager.ts handleRequest)

- **Symptom:** When only slot 1 needed to switch, slot 0 got empty move selector (no `active` array in forceSwitch requests)
- **Fix:** Detects this case, sets slot 0 action to `pass` sentinel, shows slot 1's switch menu directly

## Pitfalls & gotchas encountered

- **Microtask ordering in async stream processing:** Extensive analysis of `@pkmn/streams` ObjectReadWriteStream and Promise resolution ordering was needed to verify that `resolveReady` is set before `processOutput` runs. The key insight: `resolvePush()` schedules a microtask chain (3 layers deep through `loadIntoBuffer` → `next()` → `for await`), while `handleAITurn` returning schedules a direct microtask. The direct microtask runs first due to FIFO ordering, ensuring `waitForUpdate` sets `resolveReady` before the stream processes the new request.
- **`@pkmn/sim` doubles choice format:** Must be `action1, action2` (comma-separated). For partial forceSwitch, non-acting slots must send `pass`. Single actions are rejected.
- **`actionToChoice` target vs tera ordering:** Target slot must come BEFORE tera/mega flags. `@pkmn/sim` strips flags from the end before parsing the target. This was already fixed in a prior session.
- **`forceSwitch` is an array in doubles:** `[true, false]`, `[false, true]`, or `[true, true]`. Single boolean in singles. Must use `Array.isArray()` check.

## Files changed

- `apps/web/src/features/battle/components/MoveSelector.tsx` — text color fix, 2x3 grid layout, global tera toggle, tera guard
- `apps/web/src/features/battle/components/BattleView.tsx` — read only (for understanding)
- `packages/battle-engine/src/battle-manager.ts` — doubles submitAction two-step flow, readStream error handling, error recovery, waitForUpdate timeout, forceSwitch pass handling, AI doubles logging
- `packages/battle-engine/src/protocol-parser.ts` — parseRequest doubles forceSwitch fix, extractSwitches active filter
- `tests/battle-engine/protocol-parser.test.ts` — updated switch count expectation (active filter)
- `tests/battle-engine/battle-manager-coverage.test.ts` — updated error message string, forceSwitch pass expectation

## Known issues & next steps

- **Doubles battle needs real-world testing** — The multiple fixes address different failure modes but the exact root cause of the user's "stuck on waiting" may be revealed by the console logs (`[BattleManager]` prefix). If it still hangs, the logs will pinpoint the issue.
- **AI could pick same switch target for both doubles slots** — Both slots get the same `switches` list. If both decide to switch (low damage scenario), they could pick the same target. The sim would reject this. A fix would deduplicate switch targets between slots.
- **Doubles forceSwitch `[false, true]` UI may need polish** — The "pass" sentinel approach works functionally but the UX of jumping directly to slot 1's switch menu without showing slot 0 could be confusing.
- **Console.log statements** — Diagnostic logging was added intentionally for debugging. Should be removed or converted to debug-level after doubles is confirmed working.

## Tech notes

- **`@pkmn/sim` BattleStream protocol:** After a player submits in doubles, the sim does NOT send a `|request|wait` — it silently stores the choice and waits for the other player. Output only arrives after both players submit.
- **`@pkmn/sim` forceSwitch in doubles:** Request has `forceSwitch: [bool, bool]` array and NO `active` array. Each slot that needs to switch gets `true`. The expected choice format is `switch X, pass` or `pass, switch X` for partial switches.
- **`@pkmn/streams` ObjectReadStream.push():** Called synchronously during `BattleStream.write()`. Resolves `nextPush` promise which triggers a 3-layer microtask chain. Multiple pushes before the loop processes go into a buffer.
- **React state vs manager state:** The `BattleManager.state` object is mutated in place. React state is a separate snapshot created via `setState({ ...manager.getState() })`. Event handler calls (`onUpdate`) also create snapshots. Multiple setState calls within microtask batches are coalesced by React.
