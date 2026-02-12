# Fix Battle Replay Timing — Animation-Aware Frame Advancement

## Context

Battle replays advance frames at a fixed 1500ms interval regardless of how many events occur in each turn. Turns with many events (move + crit + supereffective + damage + faint + switch + hazard damage) get the same 1500ms as turns with a single event, making it impossible to read the narration.

The animation system (`useReplayAnimations`) already plays events sequentially with proper per-event durations, but the frame advancement system (`useReplay`) doesn't wait for animations to finish.

## Approach: Signal-Based Coordination

Instead of pre-computing animation durations, `useReplayAnimations` will signal when it's done via an `onComplete` callback, and `useReplay` will wait for that signal + an inter-frame pause before advancing.

This is the single-source-of-truth approach — the animation system that actually plays events controls timing.

## Changes (3 files)

### 1. `apps/web/src/features/battle/hooks/use-replay-animations.ts`

- Add `onComplete?: () => void` to options parameter
- Store in a ref (`onCompleteRef`) to avoid invalidating `processQueue`'s `useCallback`
- Fire `onCompleteRef.current?.()` in two places:
  - In `processQueue` when the queue empties (line ~36, where `isAnimating` resets)
  - In the frame-change effect when there are zero animatable entries (line ~83, the else branch)

### 2. `apps/web/src/features/battle/hooks/use-replay.ts`

- Remove the fixed `setInterval(1500 / speed)` auto-advance logic (lines 44-69)
- Remove `intervalRef`
- Add constants: `INTER_FRAME_PAUSE = 500` (ms between frames at 1x speed)
- Add `speedRef` and `isPlayingRef` refs to avoid stale closures
- Add `onFrameAnimationsComplete` callback:
  - Guards on `isPlayingRef.current` (no-ops when paused)
  - Clears any pending timeout
  - Schedules `setTimeout(advance, INTER_FRAME_PAUSE / speed)`
  - The advance reads next frame from engine, updates state, or stops at end
- Add play-start effect: when `isPlaying` transitions false→true, schedule the first advance after the inter-frame pause (since current frame is already displayed)
- Add cleanup effect: clear timeout when pausing
- Export `onFrameAnimationsComplete` in return object

### 3. `apps/web/src/app/battle/replay/[battleId]/page.tsx`

- Pass `replay.onFrameAnimationsComplete` as `onComplete` to `useReplayAnimations` options (line ~81)

## Edge Cases

| Case                  | Handling                                                                          |
| --------------------- | --------------------------------------------------------------------------------- |
| Empty frames (turn 0) | `onComplete` fires immediately, `INTER_FRAME_PAUSE` provides minimum display time |
| Speed change mid-play | `speedRef.current` always up-to-date in callbacks, next pause uses new speed      |
| Seek while playing    | Frame change resets animation queue, `onComplete` fires when new animations done  |
| Play/pause toggle     | `isPlaying` effect clears timeout on pause; `wasPlayingRef` prevents double-start |
| Last frame            | `engine.nextFrame()` returns null → `setIsPlaying(false)`                         |
| Win event             | `logEntryToAnimation` gives it 2000ms minimum — enough to read                    |

## Verification

1. `pnpm test` — ensure no regressions
2. Manual QA in browser:
   - Play replay at 1x — text should be fully readable before next frame
   - Play at 2x/4x — everything speeds up proportionally
   - Pause mid-frame — animations continue, no advance
   - Resume — advance triggers after current animations complete
   - Drag slider while playing — playback resumes from new position
   - Watch a long turn (multiple events) vs short turn — pacing should feel natural
