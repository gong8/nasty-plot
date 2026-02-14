# Session: Chat Queue & Fullscreen Mode

**Date:** 2026-02-14
**Duration context:** Medium

## What was accomplished

- **Chat message queue:** Users can now type and submit their next message while Pecharunt is streaming a response. The message appears as a "Queued" bubble with edit/delete controls, and auto-sends when the current stream finishes.
- **Chat fullscreen mode:** Added a maximize/minimize toggle in the sidebar header. Fullscreen expands the chat to cover the entire viewport (`100vw`), shows the session list as a permanent left column, and caps message width at `max-w-3xl` for readability.
- **Session list scroll fix:** Fixed a pre-existing bug where the chat session list was not scrollable in any context (collapsible dropdown, fullscreen column, or fullpage mode).

## Key decisions & rationale

- **Ref + state dual tracking for queued message:** `queuedMessageRef` avoids stale closures in `finalizeStream` (which is defined inline, not in a `useCallback`), while `queuedMessage` state drives UI rendering. The ref is the source of truth for the dequeue logic.
- **`sendMessageRef` pattern:** `finalizeStream` needs to call `sendMessage` but can't depend on it directly (would create stale closure). A ref that syncs via `useEffect` solves this cleanly.
- **`setTimeout(0)` for dequeue:** Avoids calling `sendMessage` during the `setIsStreaming(false)` state update in `finalizeStream`. Defers to the next tick.
- **Queuing replaces, doesn't append:** Submitting a second message while one is already queued overwrites it. This keeps the mental model simple (one queue slot).
- **Regenerations bypass the queue:** `sendMessage` with `regenerate=true` is never queued — it's an internal operation, not a user-initiated message.
- **Fullscreen as overlay, not route:** The sidebar is already `position: fixed` with `z-[60]`, so expanding to `100vw` naturally overlays everything. No new route or layout needed.
- **Session list in fullscreen:** In normal sidebar mode, session history is a collapsible dropdown. In fullscreen, the extra horizontal space is used by showing sessions as a permanent `w-64` left column, which is more usable.
- **`max-w-3xl mx-auto` on message container:** Prevents messages from stretching unreadably wide in fullscreen. Also applies in sidebar mode but has no visible effect since sidebar width (300-600px) is narrower than `max-w-3xl` (768px).
- **Main content margin-right = 0 in fullscreen:** Since the sidebar covers everything, pushing the main content rightward would just cause it to overflow off-screen pointlessly.

## Bugs found & fixed

- **Session list not scrollable (pre-existing):** The `ChatSessionList` root div had `flex flex-col` but no height constraint (`min-h-0`) and no flex sizing (`flex-1` for sidebar mode). In a flex column layout, children default to `min-height: auto` (content size), so the inner `overflow-y-auto` div never got a bounded height and could never scroll. Fixed by adding `min-h-0` universally and `flex-1` in sidebar mode to the root div.
- **Fullscreen session list column not scrollable:** The wrapper div in `chat-sidebar.tsx` for the fullscreen session list column needed `min-h-0 overflow-hidden` to properly constrain the height for the inner scroll container.

## Pitfalls & gotchas encountered

- The `finalizeStream` function is defined as a plain function inside the hook (not `useCallback`), so it captures stale closures from the render it was created in. This is why `queuedMessageRef` and `sendMessageRef` are necessary rather than reading state directly.
- The existing `autoSendMessage` flow (guided builder proactive reactions) runs via a separate `useEffect` in `ChatPanel` that watches `isStreaming`. The queued message dequeue in `finalizeStream` fires via `setTimeout(0)`, which means `autoSendMessage` gets priority since its effect runs in the same React commit as `setIsStreaming(false)`. This matches the plan's requirement.
- **Flex `min-height: auto` gotcha:** This is a recurring CSS issue. In a flex column, children won't shrink below content size unless `min-h-0` is set. Any scrollable flex child needs `min-h-0` on itself or its ancestors in the flex chain. The session list had `overflow-y-auto` on an inner div, but every ancestor up to the height-constrained container needed `min-h-0` for it to work.

## Files changed

- `apps/web/src/features/chat/hooks/use-chat-stream.ts` — Added `queuedMessage` state/ref, `sendMessageRef`, modified `sendMessage` to queue during streaming, modified `finalizeStream` to auto-dequeue, added `clearQueuedMessage`/`updateQueuedMessage`, cleared queue in `resetForSession`
- `apps/web/src/features/chat/components/chat-input.tsx` — Removed `isStreaming` from textarea `disabled` and `handleSend` guard, added `queuedMessage` prop for contextual placeholder text
- `apps/web/src/features/chat/components/chat-panel.tsx` — Added `QueuedMessageBubble` component (edit/delete UI), rendered queued bubble before scroll anchor, passed `queuedMessage` to `ChatInput`, added `max-w-3xl mx-auto` on message container, added `queuedMessage` to auto-scroll deps
- `apps/web/src/features/chat/context/chat-provider.tsx` — Added `isFullscreen` state, `toggleFullscreen` callback, exposed both in context value
- `apps/web/src/components/chat-sidebar.tsx` — Added Maximize2/Minimize2 toggle button, fullscreen layout (100vw width, session list as left column, hidden resize handle and history toggle), added `min-h-0 overflow-hidden` on fullscreen session list wrapper
- `apps/web/src/components/app-shell.tsx` — Set `mainMarginRight` to 0 when fullscreen
- `apps/web/src/features/chat/components/chat-session-list.tsx` — Added `min-h-0` to root div, added `flex-1` in sidebar mode to fill parent height (fixes scrolling in all contexts)

## Known issues & next steps

- **No keyboard shortcut for fullscreen toggle** — could add e.g. `Cmd+Shift+L` alongside the existing `Cmd+L` for sidebar toggle
- **Fullscreen state is transient** — not persisted to localStorage. This is intentional (you probably don't want to reopen the app in fullscreen chat mode), but could be reconsidered
- **Queue doesn't persist across session switches** — by design (cleared in `resetForSession`), but the UX could be debated
- **No animation on fullscreen transition** — the sidebar snaps from its width to 100vw. A CSS transition on width could smooth this, but `100vw` vs pixel values might cause issues with transitions

## Tech notes

- The `QueuedMessageBubble` component is defined inline in `chat-panel.tsx` rather than as a separate file. It's small and tightly coupled to the panel's queued message state — extracting it would add a file without meaningful benefit.
- The `ChatSessionList` component accepts a `mode` prop (`"sidebar"` | `"fullpage"`) and an optional `onSelect` callback. In fullscreen, it's rendered in `"sidebar"` mode without `onSelect` so clicking a session doesn't collapse anything.
- The chat sidebar's outer container changed from `flex flex-col` to just `flex` to accommodate the horizontal layout (session list left + chat right) in fullscreen mode. The chat area is wrapped in a new `flex-1 min-w-0 flex flex-col` div.
- **Flex scroll pattern:** For any scrollable area inside a flex layout, the entire ancestor chain from the height-constrained container down to the `overflow-y-auto` element needs `min-h-0` on each flex-col child. Missing it on even one level breaks scrolling.
