# Session: Context Mismatch Detection for Chat Sessions

**Date:** 2026-02-11
**Duration context:** Medium

## What was accomplished

- Fixed backend teamId/formatId priority so frozen context wins for context-locked sessions (`team-editor`, `guided-builder`, `battle-live`, `battle-replay`)
- Created `useContextMismatch` hook that detects when the active chat session's frozen context doesn't match the current page
- Created `ContextMismatchBanner` component — amber warning banner with navigation button and "Start new chat" link
- Added `disabled` prop to `ChatInput` — disables textarea, send button, hides retry, changes placeholder
- Integrated mismatch detection into `ChatPanel` — renders banner and disables input when mismatched
- Added context-aware session list filtering in `ChatSessionList` — on contextual pages, only shows relevant sessions by default with a "Show all" toggle
- Ran parallel code review agents that caught an overly strict pageType check (team-editor chat falsely mismatching on guided-builder for same team) and missing typeof guards — both fixed

## Key decisions & rationale

- **Reused existing `useChatSession` hook** instead of creating a new `useChatSessionMeta` hook — shares React Query cache with other components fetching the same session, avoiding duplicate requests. Plan suggested a separate query key but this is better for cache coherence.
- **Team mismatch checks teamId only, not pageType** — a `guided-builder` chat should NOT show mismatch on `team-editor` for the same team since both pages share the same team data. Plan was ambiguous here; review agents caught the issue.
- **battle-live mismatch checks pageType only** — no stable battle ID exists in the URL, so page type match is sufficient. All battle-live sessions show as relevant on the battle-live page.
- **Frozen context priority in both route.ts and chat.service.ts** — both files need independent resolution because `chat.service.ts` can be called from CLI chat (not just the API route). Both now use the same priority logic.

## Bugs found & fixed

- **Backend teamId resolution prioritized live over frozen** — context-locked sessions sent to the LLM with `effectiveTeamId` from the _current_ page rather than the frozen session context. Root cause: `teamId || context?.teamId` evaluated before parsing `sessionContextData`. Fix: check `sessionContextMode` first, then parse frozen `ctxData.teamId` with priority.
- **Overly strict pageType match in mismatch hook** — initial implementation required both `pageType === contextMode` AND `teamId` match, causing false mismatch when navigating between team-editor and guided-builder for the same team. Fix: removed pageType check for team contexts.

## Pitfalls & gotchas encountered

- The 3 test failures in `tests/llm/chat.service.test.ts` are **pre-existing** — they mock `fetch` but the code uses direct `getTeam`/`getUsageStats` imports. Verified by stashing changes and running the same tests on the original code.
- `chat.service.ts` and `route.ts` both resolve teamId/formatId independently — this is intentional (CLI chat vs API route), but means the priority logic must be kept in sync in both files.

## Files changed

| File                                                                | Change                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/app/api/chat/route.ts`                                | Fixed teamId/formatId priority for context-locked sessions |
| `packages/llm/src/chat.service.ts`                                  | Same priority fix in duplicate fallback logic              |
| `apps/web/src/features/chat/hooks/use-context-mismatch.ts`          | **NEW** — mismatch detection hook                          |
| `apps/web/src/features/chat/components/context-mismatch-banner.tsx` | **NEW** — amber warning banner component                   |
| `apps/web/src/features/chat/components/chat-panel.tsx`              | Integrated mismatch hook + banner + disable input          |
| `apps/web/src/features/chat/components/chat-input.tsx`              | Added `disabled` prop                                      |
| `apps/web/src/features/chat/components/chat-session-list.tsx`       | Context-aware filtering with show all/relevant toggle      |

## Known issues & next steps

- **Pre-existing test failures** in `tests/llm/chat.service.test.ts` (3 tests) — tests mock `fetch` but `chat.service.ts` uses `getTeam`/`getUsageStats` directly. These tests need to mock `#teams/team.service` and `#smogon-data/usage.service` instead.
- **No unit tests for new code** — `useContextMismatch`, `ContextMismatchBanner`, and session list filtering have no test coverage. Consider adding tests for mismatch detection logic and filtering.
- **Manual verification needed** — the plan includes a verification checklist (backend fix, mismatch banner, session list filtering, general sessions, battle sessions) that should be tested in the browser.

## Tech notes

- `ChatContextMode` type: `"guided-builder" | "team-editor" | "battle-live" | "battle-replay"` — defined in `packages/core/src/chat-context.ts`
- `contextData` is stored as a JSON string on the session. Different context modes store different shapes: `TeamChatContextData` (teamId, teamName, formatId), `BattleLiveChatContextData` (formatId, team names), `BattleReplayChatContextData` (battleId, formatId, team names, turnCount, winnerId).
- `usePageContext()` derives page type from pathname via regex matching in `page-context-provider.tsx`. It also extracts teamId/pokemonId/battleId from the URL.
- `useChatSession(id)` uses React Query key `["chat-session", id]` — the mismatch hook piggybacks on this cache.
- The session list's `sessionMatchesPage` function parses `contextData` JSON for each session on every render — memoized via `useMemo` but could become expensive with many sessions.
