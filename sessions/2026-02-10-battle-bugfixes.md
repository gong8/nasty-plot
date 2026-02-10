# Session: Battle Save & Force Switch Bugfixes

**Date:** 2026-02-10
**Duration context:** Medium

## What was accomplished

- Diagnosed and resolved the "Failed to save battle" 500 error from the `/api/battles` POST endpoint
- Diagnosed and fixed the `"[Invalid choice] Can't move: You need a switch response"` error in `BattleManager`
- Fixed a defensive fallback in `pickHealthiestSwitch` that returned a move action during force switch scenarios

## Key decisions & rationale

- **Concurrency guard over UI-only fix:** Added a `submitting` flag in `BattleManager` rather than only disabling UI buttons. This is more robust — it protects against any caller, not just the React UI, and prevents the stream from receiving duplicate commands regardless of React's render timing.
- **Set `waitingForChoice = false` immediately in `submitAction`:** Moved this before the stream write/AI delay rather than after, so the internal state reflects "not waiting" as soon as possible.
- **Changed `pickHealthiestSwitch` fallback to switch instead of move:** The previous fallback `{ type: "move", moveIndex: 1 }` would always be rejected by the sim during `forceSwitch`. Even though empty switches during forceSwitch is an edge case (battle should be over), returning a switch is the only valid response.

## Bugs found & fixed

### Bug 1: Battle save returns 500 — stale Prisma client

- **Symptom:** Clicking "Save Battle" after a battle ended showed "Failed to save battle" toast. API returned `{"error":"Failed to save battle"}` with status 500.
- **Root cause:** `prisma.battle` was `undefined` in the Next.js runtime. The Battle model was added in migration `20260210052423_add_battle_models` and `prisma generate` was run, but the dev server was never restarted afterward. Turbopack cached the old Prisma client that doesn't include the Battle model.
- **Fix:** Restart the dev server after `prisma generate`. This is the documented gotcha in CLAUDE.md.
- **Actual error:** `Cannot read properties of undefined (reading 'create')` — confirmed by temporarily exposing the error message in the API catch block.

### Bug 2: Force switch race condition — concurrent action submissions

- **Symptom:** `[BattleManager] Error: "[Invalid choice] Can't move: You need a switch response"` appearing in console, battle getting stuck.
- **Root cause:** `BattleManager.submitAction` had no guard against concurrent calls. The async function writes to the stream then waits 300-1000ms for the AI's artificial "thinking" delay. During that window, React state hadn't updated (move buttons still visible and clickable). A second click wrote another `>p1 move X` to the stream. When the first turn resolved with a KO, the sim received the stale second move command when it expected a switch.
- **Fix:** Added `private submitting = false` flag. Both `submitAction` and `chooseLead` now check `if (this.submitting) return` at the top and wrap their logic in `try/finally` to reset the flag.

### Bug 3: `pickHealthiestSwitch` returns move during force switch

- **Symptom:** Could cause the same "need a switch response" error from the AI side if `actions.switches` was empty after filtering.
- **Root cause:** The fallback `{ type: "move", moveIndex: 1 }` is always invalid during a `forceSwitch` — the sim only accepts switch commands.
- **Fix:** Changed fallback to `{ type: "switch", pokemonIndex: actions.switches[0]?.index ?? 1 }`.

## Pitfalls & gotchas encountered

- **Turbopack Prisma cache:** After `prisma generate` adds new models, the Next.js dev server MUST be restarted. Turbopack aggressively caches the old Prisma client. The error appears as `undefined` property access on `prisma.<newModel>` — not an obvious Prisma error.
- **Debugging API errors:** The battles API catch block returned a generic `"Failed to save battle"` message, hiding the real error. Temporarily surfacing `err.message` was key to diagnosing the stale Prisma client issue.
- **React state lag during async operations:** Between calling an async function and the React re-render, the UI state is stale. Move buttons remain clickable even though the engine has already submitted an action. This is a general React pattern issue with imperative async APIs.

## Files changed

- `packages/battle-engine/src/battle-manager.ts` — Added `submitting` concurrency guard to `submitAction` and `chooseLead`
- `packages/battle-engine/src/ai/shared.ts` — Fixed `pickHealthiestSwitch` fallback to return switch instead of move
- `tests/battle-engine/shared.test.ts` — Updated 2 tests to match corrected `pickHealthiestSwitch` behavior
- `apps/web/src/app/api/battles/route.ts` — Temporarily modified for debugging, then reverted (no net change)

## Known issues & next steps

- **Battle save still requires dev server restart:** The fix is operational (restart), not code. The save functionality will work after restarting `pnpm dev`.
- **UI doesn't disable move buttons while loading:** The `isLoading` state from `useBattle` is not passed to `BattleView` or its children. The `submitting` guard in BattleManager prevents the bug, but adding visual feedback (disabled/grayed buttons during action processing) would improve UX.
- **`handleAIForceSwitch` is fire-and-forget:** In `handleRequest`, `this.handleAIForceSwitch(parsed.actions)` is called without `await`. This works because the sim won't send new chunks until both players act, but it's fragile. Consider awaiting it or restructuring the async flow.
- **`resolveReady` can be overwritten:** If two async operations both set `this.resolveReady`, the first one's promise will never resolve. The `submitting` guard prevents this in practice, but `waitForUpdate` could be made more robust with a queue.

## Tech notes

- **`@pkmn/sim` BattleStream:** Writes are processed synchronously by the sim. `stream.write(">p1 move 1")` immediately buffers p1's action. The sim resolves the turn only when both players have acted. Output chunks may contain both p1 and p2 requests in a single chunk.
- **`forceSwitch` in sim requests:** `req.forceSwitch` is an array like `[true]` for singles. The `parseRequest` function checks truthiness, which works because the field is only present when a force switch is needed (the sim omits it otherwise).
- **AI thinking delay:** `handleAITurn` has `300 + Math.random() * 700`ms delay, `handleAIForceSwitch` has `200 + Math.random() * 300`ms. These create the window for the race condition.
- **Direct Prisma test:** Running `prisma.battle.create(...)` via `tsx` bypasses Turbopack entirely and works fine — useful for isolating whether the issue is Prisma schema vs. Next.js runtime.
