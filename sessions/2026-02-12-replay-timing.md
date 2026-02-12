# Session: Replay Animation-Aware Timing

**Date:** 2026-02-12
**Duration context:** Short

## What was accomplished

- Implemented signal-based coordination between `useReplayAnimations` and `useReplay` hooks so that battle replay frame advancement waits for all animations to finish before proceeding
- Replaced the fixed `setInterval(1500ms / speed)` auto-advance with an `onComplete` callback pattern where the animation system signals when it's done, and the replay system schedules the next advance after an inter-frame pause

## Key decisions & rationale

- **Signal-based over pre-computed durations:** Instead of trying to calculate total animation time per frame upfront, the animation hook that actually plays events fires a callback when done. This is the single-source-of-truth approach — no risk of timing drift.
- **`INTER_FRAME_PAUSE = 500ms` at 1x:** Provides a readable gap between frames. Scales with speed (`500 / speed`), so 2x = 250ms, 4x = 125ms.
- **Refs for closure-safe state:** `speedRef`, `isPlayingRef`, `wasPlayingRef` avoid stale closures in `setTimeout` callbacks — a common React hooks pattern for timer-based logic.

## Bugs found & fixed

- **Core bug fixed:** Turns with many events (move + crit + super effective + damage + faint + switch + hazard damage) got the same 1500ms as turns with a single event, making narration text unreadable before the next frame advanced.

## Pitfalls & gotchas encountered

- None — the plan was well-specified and implementation was straightforward.

## Files changed

- `apps/web/src/features/battle/hooks/use-replay-animations.ts` — Added `onComplete` callback option, fires when animation queue empties or when frame has zero animatable entries
- `apps/web/src/features/battle/hooks/use-replay.ts` — Replaced `setInterval` with `onFrameAnimationsComplete` + `setTimeout` pattern, added `INTER_FRAME_PAUSE` constant, refs for stale closure prevention
- `apps/web/src/app/battle/replay/[battleId]/page.tsx` — Wired `replay.onFrameAnimationsComplete` to `useReplayAnimations`'s `onComplete` option

## Known issues & next steps

- 5 pre-existing test failures in `tests/llm/` and `tests/smogon-data/` (unrelated to replay)
- Manual QA recommended per the plan: test 1x/2x/4x speed, pause/resume mid-frame, slider seek while playing, long vs short turns
- Plan file `plans/replay-animation-aware-timing.md` can be archived after QA passes

## Tech notes

- `useReplayAnimations` processes a queue of `AnimationEvent` objects sequentially via `setTimeout` chains. When the queue empties, it resets `isAnimating` and fires `onComplete`.
- The play-start effect uses `wasPlayingRef` to detect false→true transitions and kick off the first advance (since the current frame is already displayed when play is pressed).
- `onCompleteRef` pattern (storing callback in a ref) prevents the `processQueue` `useCallback` from needing the callback in its dependency array, which would cause re-creation on every render.
