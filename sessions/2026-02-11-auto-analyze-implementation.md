# Session: Auto-Analyze Battle Coaching Implementation

**Date:** 2026-02-11
**Duration context:** Long (spanned 3 conversations due to context exhaustion)

## What was accomplished

### Phase 1-8: Full Auto-Analyze Feature (prior conversations)

- **Implemented the full 8-phase "Pecharunt Auto-Analyze" feature** — an auto-coaching mode where Pecharunt automatically analyzes each battle turn in the chat sidebar without manual prompting
- **Phase 1 — Schema & Core Types**: Added `metadata` column to `ChatMessage`, `chatSessionId` to `Battle` with relation to `ChatSession`, new `AutoAnalyzeDepth` and `ChatMessageMetadata` types in `@nasty-plot/core`, `autoAnalyze` field on `BattleCheckpoint`
- **Phase 2 — Prompt Builder**: Added `buildAutoAnalyzePrompt()` to `battle-context-builder.ts` with quick (concise, no tools) and deep (MCP tools, detailed strategy) modes
- **Phase 3 — Chat Service Metadata**: Extended `addMessage()` and `mapSession()` in `chat-session.service.ts` to handle metadata, added `disableAllTools` option to `chat.service.ts`, extended chat API route for `autoAnalyzeDepth` + `metadata`
- **Phase 4 — ChatProvider State**: Added `StreamControl` pattern for cross-component stream control, auto-analyze state (`enabled`, `depth`), and `triggerAutoAnalyze`/`stopAutoAnalyze` delegates
- **Phase 5 — useChatStream Extensions**: Added `sendAutoAnalyze()` method (SSE streaming without visible user message), metadata parsing in `loadSession()`, abort-on-action behavior ("You chose your move -- moving on!")
- **Phase 6 — useAutoAnalyze Hook**: New hook watching `state.turn`, 300ms debounce, builds prompt and triggers analysis, `abortIfAnalyzing()` callback
- **Phase 7 — UI Components**: New `TurnAnalysisCard` (collapsible card with recommendation extraction), auto-analyze depth toggle bar in `ChatPanel`, replaced Coach button with Auto-Analyze toggle in `BattleView`, removed Hints tab
- **Phase 8 — Persistence & Replay**: Checkpoint extras pattern for auto-analyze state persistence, `chatSessionId` in battle save, "Coaching" tab in replay page, resume restores auto-analyze state
- **Ran parallel verification** of all changes against the original plan using 6 Explore agents — confirmed near-perfect alignment

### Follow-up: Context Enrichment & Forced Switch Fix (this conversation)

- **Audited exactly what context Pecharunt receives** — mapped every field in `BattlePokemon`, `BattleActionSet`, `BattleSide`, `FieldState` against what `describePokemon`, `describeSide`, and `buildAutoAnalyzePrompt` actually serialize into the prompt
- **Enriched `describePokemon`** to include: types, ability, item, tera type (active vs available), known moves with types, volatiles (confusion, substitute, etc.)
- **Enriched `describeSide`** to include: bench Pokemon details (name, types, status, HP%), tera availability status (`Tera available` / `Tera used`), multi-line formatting for readability
- **Added move basePower and accuracy** to available actions section (e.g. `Close Combat (Fighting, Physical, 120 BP, 100% acc, 5/5 PP)`)
- **Added canTera flag** — shows `"Tera: Available this turn"` when player can still terastallize
- **Added forceSwitch handling** — prompt changes to `"## FORCED SWITCH — Your Pokemon fainted! Choose a switch-in:"` and recommendation format changes to recommend a Pokemon name instead of a move name
- **Added item/ability/resisted/immune log entries** to `describeLogEntries` filter — Pecharunt now sees events like "Leftovers restored HP", "Intimidate lowered attack", "It's not very effective..."
- **Fixed forced switch not triggering auto-analyze** — `useAutoAnalyze` now tracks `lastAnalyzedForceSwitch` ref and triggers when `waitingForChoice + forceSwitch` is newly true (same turn, different situation than the initial turn analysis)
- **Added switch option status** to available actions (e.g. `Garchomp (75% HP, brn)`)

## Key decisions & rationale

- **StreamControl ref pattern** for cross-component communication: BattleView triggers analysis but ChatPanel owns the stream. Using a ref-based registration avoids prop drilling and keeps components decoupled
- **`disableAllTools` for Quick mode**: Quick analysis disables all MCP tools server-side to ensure fast ~2-3s responses without tool call overhead
- **`state.log.slice(-10)` instead of full log**: Only passes last 10 log entries to avoid huge prompts on long battles — trades completeness for token efficiency
- **Full file overwrites via Write tool**: Used Write instead of Edit for 4 UI files because a linter/formatter kept reverting incremental edits
- **Checkpoint extras callback pattern**: `setCheckpointExtras` lets the live page inject auto-analyze state into checkpoints without modifying the core `useBattle` hook's checkpoint logic
- **Enriched shared `describePokemon`** rather than creating a separate auto-analyze-only version — all consumers (commentary, turn analysis, auto-analyze) benefit from richer context
- **`lastAnalyzedForceSwitch` ref** for forced switch detection — simple boolean ref tracks whether the current forced switch has been analyzed. Reset when a non-forced-switch choice arrives. Avoids re-triggering on the same forced switch.

## Bugs found & fixed

- **Forced switch after KO doesn't trigger auto-analyze**: `useAutoAnalyze` only watched `state.turn` changes. When a Pokemon faints mid-turn, the turn number stays the same so analysis never fired. Fixed by adding `lastAnalyzedForceSwitch` ref that detects new `waitingForChoice + forceSwitch` states
- **`hpPercent` property doesn't exist on switch type**: `battle-context-builder.ts` used `s.hpPercent` for switch options, but the switch type only has `hp` and `maxHp`. Fixed with `Math.round((s.hp / s.maxHp) * 100)` and a zero-division guard
- **Pecharunt missing critical battle info**: `describePokemon` only showed name/HP/status/boosts — missing types, abilities, items, moves, tera types, and volatiles. Enriched to include all available info
- **Pre-existing test failures** (3 in `tests/llm/chat.service.test.ts`): Team context, system prompt, and meta context assertions fail. Confirmed pre-existing by running tests on clean main via `git stash`. Not caused by our changes

## Pitfalls & gotchas encountered

- **Linter reverting UI files**: A linter/formatter triggered on file save would revert 4 UI files (chat-provider.tsx, use-chat-stream.ts, chat-panel.tsx, BattleView.tsx) back to their original state when using the Edit tool. Solved by using Write tool (full file overwrite) which atomically replaces content. This consumed significant time across 2 sessions
- **Context exhaustion**: The first conversation ran out of context mid-implementation (after Phase 7). The continuation session had to verify which changes survived (backend files did, 4 UI files were reverted) and re-apply them
- **`git stash` triggered linter reverts**: Running `git stash` to test clean code caused the linter to fire on the restored clean files, but `git stash pop` correctly restored all changes
- **Opponent info is only what's revealed**: For p2 (opponent), `BattlePokemon` fields like ability/item/moves are only populated when revealed during battle via protocol events. So including them in the prompt doesn't leak hidden info — the protocol parser handles information hiding

## Files changed

### New files (2 + 1 migration)

- `apps/web/src/features/battle/hooks/use-auto-analyze.ts` — Hook: watches turns + forced switches, triggers analysis, handles abort
- `apps/web/src/features/chat/components/turn-analysis-card.tsx` — Collapsible card for auto-generated analysis
- `prisma/migrations/20260211212508_add_auto_analyze_fields/migration.sql` — Schema migration

### Modified files

- `prisma/schema.prisma` — ChatMessage.metadata, Battle.chatSessionId + relations
- `packages/core/src/types.ts` — AutoAnalyzeDepth, ChatMessageMetadata types
- `packages/battle-engine/src/types.ts` — autoAnalyze on BattleCheckpoint
- `packages/llm/src/battle-context-builder.ts` — Enriched describePokemon/describeSide, buildAutoAnalyzePrompt with forceSwitch/canTera/basePower/accuracy, expanded log entry filter
- `packages/llm/src/index.ts` — New exports
- `packages/llm/src/chat-session.service.ts` — Metadata in addMessage/mapSession
- `packages/llm/src/chat.service.ts` — disableAllTools option
- `packages/llm/src/tool-context.ts` — getAllMcpToolNames() export
- `apps/web/src/app/api/chat/route.ts` — autoAnalyzeDepth + metadata passthrough
- `apps/web/src/app/api/battles/route.ts` — chatSessionId in create
- `apps/web/src/app/api/battles/[battleId]/replay/route.ts` — chatSessionId in select
- `apps/web/src/features/chat/context/chat-provider.tsx` — Auto-analyze state, StreamControl
- `apps/web/src/features/chat/hooks/use-chat-stream.ts` — sendAutoAnalyze(), metadata, abort
- `apps/web/src/features/chat/components/chat-panel.tsx` — TurnAnalysisCard, depth toggle bar
- `apps/web/src/features/battle/components/BattleView.tsx` — Auto-Analyze button, removed Hints tab
- `apps/web/src/features/battle/hooks/use-battle.ts` — Checkpoint extras, chatSessionId in save
- `apps/web/src/app/battle/live/page.tsx` — Checkpoint persistence, resume restore
- `apps/web/src/app/battle/replay/[battleId]/page.tsx` — Coaching tab

## Known issues & next steps

### Minor deviations from plan (low priority)

1. **TurnAnalysisCard auto-collapse**: Plan says "auto-expands while streaming, collapses when complete" — implementation stays expanded after streaming ends (user must manually collapse)
2. **useAutoAnalyze dependency array**: Includes full `state` object, which re-evaluates the effect on every state change. The ref guards prevent duplicate triggers but it's slightly inefficient — could be optimized to depend on specific state fields only

### Pre-existing issues

- 3 test failures in `tests/llm/chat.service.test.ts` (team context, system prompt, meta context assertions) — pre-existing, not caused by this work

### Suggested follow-up

- Manual testing of the full flow: enable auto-analyze, play through turns, verify cards appear, test abort-on-move, test forced switch analysis, test resume from checkpoint, test replay coaching tab
- Consider adding E2E/integration tests for the auto-analyze flow
- The Hints tab was removed from BattleView — if users want algorithmic hints alongside AI coaching, this may need to be reconsidered

## Tech notes

- **StreamControl pattern**: ChatPanel registers `{ sendAutoAnalyze, stopGeneration, isStreaming }` with ChatProvider via `registerStreamControl`. BattleView triggers analysis via `triggerAutoAnalyze` which delegates to the registered controls. This avoids tight coupling between battle and chat features
- **Metadata flow**: `ChatMessageMetadata` is stored as JSON string in Prisma (`metadata String?`), parsed on read in `mapSession()`. The API route accepts metadata in the request body and passes it through to both user and assistant message saves
- **Abort behavior**: When `sendAutoAnalyze` is aborted (user clicks a move/switch), the AbortError is caught and the message content is set to "You chose your move -- moving on!" instead of showing an error
- **Quick vs Deep**: Quick mode sets `disableAllTools: true` in `streamChat()`, which calls `getAllMcpToolNames()` from `tool-context.ts` to build the disallowed list. Deep mode allows all tools for damage calcs and usage lookups
- **Checkpoint extras**: The live page uses `setCheckpointExtras(() => ({ autoAnalyze: { enabled, depth, chatSessionId } }))` to inject auto-analyze state into battle checkpoints without modifying `useBattle`'s core checkpoint logic
- **Forced switch detection**: `useAutoAnalyze` uses two refs — `lastAnalyzedTurn` (number) and `lastAnalyzedForceSwitch` (boolean). A new analysis triggers when either the turn advances OR `forceSwitch` becomes true for the first time in the current choice window. The `lastAnalyzedForceSwitch` ref resets whenever a non-forced-switch `waitingForChoice` arrives.
- **Opponent info scoping**: `BattlePokemon` fields for the opponent (p2) are only populated when revealed through `@pkmn/sim` protocol events (e.g. `-ability`, `-item`, `|move|`). So including ability/item/moves in `describePokemon` doesn't leak hidden information — the protocol parser handles information hiding at the data layer.
- **`describePokemon` output format**: Changed from parenthesized `"Garchomp (75% HP) (brn)"` to pipe-delimited `"Garchomp | Ground/Dragon | 75% HP | brn | Ability: Rough Skin | Item: Rocky Helmet | ..."` for better readability with more fields.
