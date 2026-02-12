# Session: Chat Context Picker for Empty Sessions

**Date:** 2026-02-11
**Duration context:** short

## What was accomplished

- Added an inline context mode picker that appears when opening a new chat with Pecharunt (no messages, no active session)
- Users must now choose between **Global** (general-purpose) and **Context-locked** (scoped with specific tools) before chatting
- The chat input is hidden until a mode is selected, enforcing the choice as a gate
- Context-locked option is disabled with an explanatory message on pages without a relevant context (e.g. home, pokemon browser, dedicated chat page)
- On context-capable pages (team editor, guided builder, battle live, battle replay), the context-locked button shows the specific role name (Team Building Advisor, Battle Coach, etc.) and describes available tools

## Key decisions & rationale

- **Inline picker vs modal:** Chose to embed the picker directly in the `ChatPanel` empty state rather than reusing the existing `NewChatModal`. The modal is triggered by the "New Chat" button; the picker replaces the welcome screen for brand-new chats. Both paths coexist.
- **Gate pattern:** The chat input is hidden while the picker is showing. This ensures users make a deliberate choice rather than accidentally starting a general chat. The user explicitly requested this ("it always opens it first asks you").
- **`modeChosen` state in ChatPanel:** A simple boolean tracks whether the user has dismissed the picker. It resets when the effective session ID changes (e.g. switching to a different session).
- **Context data building:** Duplicated the `buildContextData` logic from `NewChatModal` into the picker component. Both need access to `usePageContext()` and `useBattleStateContext()` to snapshot team/battle data. Extracting a shared utility was considered but avoided to keep the change minimal.

## Bugs found & fixed

- None

## Pitfalls & gotchas encountered

- The `openContextChat()` function dispatches both `NEW_SESSION` and `OPEN_SIDEBAR`. When called from the picker (sidebar already open, session already null), these are effectively no-ops — no adverse effects, but worth knowing for future changes.
- `effectiveSessionId` can be `undefined` (from `sessionId ?? activeSessionId ?? undefined`). The picker shows when it's falsy, which covers both `null` and `undefined`.

## Files changed

- `apps/web/src/features/chat/components/chat-context-picker.tsx` — **created** — new inline context mode picker component
- `apps/web/src/features/chat/components/chat-panel.tsx` — **modified** — integrated the picker into the empty state, added `modeChosen` state, hid input while picker is showing

## Known issues & next steps

- The `buildContextData` logic is duplicated between `ChatContextPicker` and `NewChatModal`. Could be extracted to a shared hook or utility if it drifts.
- On pages without context mode, the context-locked button is disabled but still visible. Could consider hiding it entirely for a cleaner UX on those pages.
- The "New Chat" button (plus icon in sidebar header) still opens the `NewChatModal` — both flows coexist. If the modal becomes redundant, it could be simplified or removed.

## Tech notes

- `PendingChatContext` (`{ contextMode, contextData }`) is stored in `ChatProvider` state. It's consumed by `useChatStream.sendMessage` on the first message of a new session, included in the POST to `/api/chat` as `contextPayload`.
- `ChatContextMode` type: `"guided-builder" | "team-editor" | "battle-live" | "battle-replay"` — defined in `packages/core/src/chat-context.ts`.
- Page-to-context-mode mapping: `guided-builder` and `team-editor` pages get full tool access (CRUD + analysis). `battle-live` and `battle-replay` get read-only tools (data query + analysis only).
- The `cn()` utility in chat components is imported from `@/lib/utils`, not from `@nasty-plot/ui`.
