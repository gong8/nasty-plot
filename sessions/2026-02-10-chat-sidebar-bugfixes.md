# Session: Chat Sidebar Bug Fixes (Continued)

**Date:** 2026-02-10
**Duration context:** Short (continuation of chat-sidebar-polish, focused on three specific bugs)

## What was accomplished

- **Fixed session loading on first click**: Chat history wouldn't load when clicking the already-active session on sidebar open. Root cause: `prevSessionRef` in `ChatPanel` was initialized to `effectiveSessionId`, so the "change detection" `useEffect` never fired on mount. Fixed by initializing to `null` sentinel so mount always triggers `resetForSession`.
- **Fixed scroll isolation**: Scrolling in the chat sidebar would bleed through to the main page body. Added `overscroll-contain` to the sidebar container div.
- **Fixed history dropdown not scrollable**: Replaced Radix `ScrollArea` in `ChatSessionList` with native `div` + `overflow-y-auto overscroll-contain` (same pattern used for the chat panel in the previous session).
- **History dropdown closes after selection**: Added `onSelect` callback prop to `ChatSessionList`, wired in `ChatSidebar` to `setShowHistory(false)` on session pick.
- **Moved "New Chat" button to sidebar header**: Relocated the `+` button from inside the history dropdown to the top-right header bar, to the left of the `X` close button. Cleaner UX — always accessible without opening history.

## Key decisions & rationale

- **`prevSessionRef` initialized to `null`**: Since `effectiveSessionId` is `string | undefined`, `null` is a safe sentinel that never matches either value, guaranteeing the mount effect fires. When `effectiveSessionId` is `undefined` (no session), the reset just clears already-empty state — harmless.
- **Native scroll div over Radix ScrollArea (again)**: Same lesson from the previous session — Radix `ScrollArea` has unreliable sizing behavior in flex containers. Native `overflow-y-auto` with `overscroll-contain` is simpler and works consistently.
- **`onSelect` callback pattern**: Rather than lifting `showHistory` state into context or using refs, a simple callback prop keeps the session list component decoupled from sidebar UI concerns.

## Bugs found & fixed

- **Session messages don't load on first click**: User opens sidebar, clicks the most recent (already-active) chat — nothing happens. Must click a different session, then click back. Cause: `prevSessionRef` initialized to `effectiveSessionId` so mount effect sees no change. Fix: initialize to `null`.
- **Scroll bleed between sidebar and main body**: Hovering over sidebar and scrolling would also scroll the page behind it. Fix: `overscroll-contain` on sidebar container.
- **History dropdown not scrollable**: Many sessions couldn't be reached. The Radix `ScrollArea` inside a `max-h-[40%]` flex container didn't calculate its scrollable area properly. Fix: native scroll div.
- **History dropdown stays open after selection**: Selecting a session left the dropdown open, requiring a manual close. Fix: `onSelect` callback that closes the panel.

## Pitfalls & gotchas encountered

- **`useRef` initial value matters for change-detection effects**: A common pattern of `const prev = useRef(currentValue)` + `useEffect` that checks `current !== prev.current` will never fire on mount. If mount-time loading is needed, use a sentinel initial value.
- **Radix ScrollArea in flex layouts (recurring)**: Third time this has been an issue across sessions. Radix `ScrollArea` ref points to root wrapper, and sizing in flex/constrained containers is unreliable. Native scroll divs are the safer choice in this codebase.

## Files changed

### Modified

- `apps/web/src/features/chat/components/chat-panel.tsx` — `prevSessionRef` initialized to `null` instead of `effectiveSessionId`
- `apps/web/src/components/chat-sidebar.tsx` — Added `overscroll-contain`, moved "New Chat" `+` button to header, passes `onSelect` to session list
- `apps/web/src/features/chat/components/chat-session-list.tsx` — Replaced Radix `ScrollArea` with native scroll div, added `onSelect` prop, removed "New Chat" button and related imports

## Known issues & next steps

- **Full-page mode session list still uses old pattern**: The `ChatSessionList` in fullpage mode doesn't have an `onSelect` callback (not needed since it's a persistent panel, not a dropdown)
- **No "New Chat" button in fullpage mode**: Previously it was inside `ChatSessionList`. Now that it's in the sidebar header, fullpage mode has no "New Chat" button. May need one if fullpage mode is ever re-enabled.
- All other known issues from `2026-02-10-chat-sidebar-polish.md` still apply (LLM title generation, plan mode untested, no test coverage, etc.)

## Tech notes

- **Scroll isolation pattern**: `overscroll-contain` on any fixed/absolute panel prevents scroll chaining to parent/body. Apply to both the sidebar container and inner scrollable regions.
- **Change-detection `useEffect` mount behavior**: `useRef(initialValue)` + `useEffect` comparing `ref.current !== value` skips mount when initialized to current value. Use a sentinel (`null`, symbol) if mount-time execution is needed.
- **Sidebar header button layout**: History toggle on the left, title in the middle, `[+ New Chat] [X Close]` grouped on the right.
