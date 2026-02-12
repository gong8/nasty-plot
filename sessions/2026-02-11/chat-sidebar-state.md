# Session: Fix chat sidebar losing messages on close/reopen

**Date:** 2026-02-11
**Duration context:** short

## What was accomplished

- Fixed bug where chat messages disappeared when closing and reopening the chat sidebar
- Changed `ChatSidebar` from conditional rendering (`return null`) to CSS-based hiding (`display: none`) so `ChatPanel` hooks preserve state across sidebar toggles

## Key decisions & rationale

- **CSS hiding over conditional render:** The sidebar previously used `if (!isOpen) return null` which unmounted the entire `ChatPanel` component tree, destroying all `useChatStream` hook state (messages, tool calls, streaming state). Replacing with `display: none` via inline style keeps the React tree mounted so hooks survive close/open cycles. This is simpler and more reliable than trying to re-fetch messages on every remount.
- **Rejected approach — fixing `resetForSession` guard:** An initial attempt changed `currentSessionIdRef` initialization in `use-chat-stream.ts` from `useRef(sessionId)` to `useRef(undefined)` to fix a guard that skipped `loadSession` on remount. This was reverted by the linter and is unnecessary with the CSS-hiding approach since the component no longer unmounts.

## Bugs found & fixed

- **Chat sidebar loses messages on close/reopen:** When the user closed the sidebar and reopened it, all chat messages were gone. The workaround was clicking to a different chat session and back, which forced a reload. Root cause: `chat-sidebar.tsx:39` returned `null` when `!isOpen`, unmounting `ChatPanel` and destroying all hook state. On remount, `useChatStream` initialized `currentSessionIdRef` with the current `sessionId`, causing the `resetForSession` guard (`id === currentSessionIdRef.current`) to match and skip `loadSession`. Fix: keep sidebar mounted with `display: none` instead of unmounting.

## Pitfalls & gotchas encountered

- The `resetForSession` guard in `use-chat-stream.ts:383` (`if (id && id === currentSessionIdRef.current) return`) serves a dual purpose: (1) prevent redundant resets for the same session, and (2) protect streaming-built messages from being cleared when `switchSession` fires post-stream. Initializing the ref to `undefined` would fix the remount case but changes behavior subtly. The CSS-hiding approach sidesteps this entirely.
- The linter reverted a type-annotation-only change to `currentSessionIdRef`, suggesting the project linter is opinionated about unnecessary type annotations on `useRef`.

## Files changed

- `apps/web/src/components/chat-sidebar.tsx` — replaced `if (!isOpen) return null` with `style={{ display: isOpen ? undefined : "none" }}` on the sidebar container div

## Known issues & next steps

- The `currentSessionIdRef` initialization bug in `use-chat-stream.ts:40` still exists — if `ChatPanel` is ever unmounted and remounted for other reasons (e.g., route navigation to/from `/chat` fullpage mode), messages won't reload. This is a latent bug that could surface in the future. Consider initializing `currentSessionIdRef` to `undefined` and using a separate `isOwnedSession` flag to protect streaming-built messages.
- The sidebar now stays mounted at all times (when not in fullpage mode). This is fine for performance since it's a single panel, but if future features add heavy children to the sidebar, consider whether keeping them mounted is still acceptable.

## Tech notes

- `ChatProvider` persists `activeSessionId` to localStorage and hydrates on mount. The sidebar's `isOpen` state also persists. So after a page refresh, the sidebar knows which session was active.
- `useChatStream` stores messages in local `useState`, not React Query. Messages are only fetched via `loadSession` (a plain `fetch` to `/api/chat/sessions/{id}`). There's no caching layer — if the component unmounts, messages must be re-fetched.
- The `deferredSessionIdRef` pattern in `useChatStream` delays calling `switchSession` until after streaming completes, preventing `ChatPanel`'s session-change effect from clearing messages mid-stream.
