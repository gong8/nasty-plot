# Session: Guided Builder Reimagine
**Date:** 2026-02-10
**Duration context:** Long (continued from a previous session that ran out of context)

## What was accomplished

- **Full rewrite of the guided team builder** — replaced the bare 4-step wizard with a 5-step teaching-focused flow: Start (choose path) -> Lead (pick anchor) -> Build (fill slots 2-6) -> Sets (customize) -> Review & Save
- **10 new components** created in `apps/web/src/features/team-builder/components/guided/`:
  - `step-start.tsx` — "Start from Scratch" vs "Start from a Sample Team" chooser
  - `step-pick-pokemon.tsx` — recommendation cards + inline manual search, reused for lead and build steps
  - `step-customize-sets.tsx` — accordion of simplified set editors with auto-apply
  - `step-review.tsx` — analysis dashboard, validation, save/test buttons
  - `recommendation-card.tsx` — sprite, types, score bar, plain-language reasons
  - `simplified-analysis.tsx` — 18-type coverage map, threats, synergy, speed tiers, suggestions
  - `simplified-set-editor.tsx` — condensed ability/item/nature/moves/tera editor with collapsible EVs
  - `concept-tooltip.tsx` — 15-term competitive Pokemon jargon dictionary
  - `role-suggestion-banner.tsx` — context-aware "your team needs X" suggestions
  - `ask-pecharunt-button.tsx` — opens chat sidebar with step-specific suggested questions
- **Hook rewrite** (`use-guided-builder.ts`) — new step model, React Query integrations for recommendations + analysis, localStorage draft persistence, sample team import, validation, chat context builder, slot fingerprint query keys
- **Orchestrator rewrite** (`guided-builder.tsx`) — renders step components, wires navigation, incremental DB persistence, save/test/freeform handlers
- **Critical DB data flow fix** — slots now persist to DB incrementally as Pokemon are picked (not just at final save), so `/api/recommend` and `/api/teams/[teamId]/analysis` return real data during building
- **Chat integration fix** — `openSidebar(message)` now accepts an optional message that pre-fills the chat input via `pendingInput` in the provider
- **Page header fix** — removed duplicate "Switch to Freeform" button that bypassed save logic
- **Context builder update** (`packages/llm/src/context-builder.ts`) — added `GuidedBuilderContext` interface and enhanced `buildPageContextPrompt()` for guided builder page context

## Key decisions & rationale

- **Incremental DB persistence over batch save** — The recommendation and analysis APIs read from Prisma/SQLite. During guided building, slots only existed in React state. Fix: persist each slot to DB immediately when picked via `addSlot` (try) / `updateSlot` (catch fallback). This upsert pattern handles both fresh picks and go-back-and-replace scenarios without tracking which positions exist in DB.
- **Slot fingerprint query keys** — Changed recommendation/analysis React Query keys from `filledSlotCount` to a sorted comma-joined `slotFingerprint` of pokemonIds. This ensures replacing a Pokemon (same count, different composition) triggers a refetch. Without this, swapping slot 2 from Garchomp to Dragonite wouldn't update recommendations.
- **Persist to DB BEFORE updating local state** — In `handleLeadPick`/`handleBuildPick`, the `await persistSlotToDb()` completes before `guided.addSlotPick()`. This ensures the DB has data by the time React Query refetches (triggered by the local state change).
- **Removed header freeform button** — The page header had a "Switch to Freeform" button that called `router.push()` directly, bypassing `saveAllSlots()`. The orchestrator footer already has a correctly-functioning freeform button. Keeping both with different behavior was a UX anti-pattern.
- **`pendingInput` in chat provider** — Rather than auto-sending suggested questions, we pre-fill the chat textarea. This lets users review/modify before sending. Implementation: `openSidebar(message?)` sets `pendingInput` state, `ChatInput` consumes it via `useEffect` and clears via `clearPendingInput()`.

## Bugs found & fixed

1. **DB data flow gap** — Recommendations and analysis returned empty/fallback data during guided building because both APIs read from `prisma.team.findUnique({ include: { slots: true } })` but slots weren't persisted until final save. Fixed with incremental persistence in the orchestrator.
2. **Suggested questions did nothing** — `ask-pecharunt-button.tsx` had `void question;` discarding the clicked question text. Fixed by wiring `openSidebar(question)` through the chat provider's new `pendingInput` mechanism.
3. **Header freeform button data loss** — Page header's "Switch to Freeform" button directly navigated without saving any slot data or set customizations. Fixed by removing the duplicate button (footer version correctly calls `saveAllSlots()` first).
4. **Query key didn't reflect slot replacements** — Using `filledSlotCount` in query keys meant replacing a Pokemon didn't trigger recommendation/analysis refetch (count unchanged). Fixed with `slotFingerprint`.

## Pitfalls & gotchas encountered

- **React Query key design matters** — Using a count as a query key part is insufficient when the underlying data can change without the count changing. Always use a fingerprint/hash of the actual data when cache invalidation depends on composition, not just cardinality.
- **Await DB writes before state updates** — When local state changes trigger query refetches that read from DB, the DB write must complete first. The pattern `await persist(); setState();` ensures correct data ordering.
- **`addSlot` service checks count, not position uniqueness** — Prisma's `teamSlot` has a compound unique key `teamId_position`. Calling `addSlot` when a slot already exists at that position throws a Prisma unique constraint error, not the "Team already has 6 slots" error. The try-add/catch-update upsert pattern handles both cases.
- **Chat provider's `openSidebar` was fire-and-forget** — No way to pass context or messages. Adding `pendingInput` state was the minimal change needed. The `ChatInput` component uses refs (not state) for the textarea value, so the `useEffect` must set both `textareaRef.current.value` AND `inputRef.current`.

## Files changed

### New files (10)
- `apps/web/src/features/team-builder/components/guided/step-start.tsx`
- `apps/web/src/features/team-builder/components/guided/step-pick-pokemon.tsx`
- `apps/web/src/features/team-builder/components/guided/step-customize-sets.tsx`
- `apps/web/src/features/team-builder/components/guided/step-review.tsx`
- `apps/web/src/features/team-builder/components/guided/recommendation-card.tsx`
- `apps/web/src/features/team-builder/components/guided/simplified-analysis.tsx`
- `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx`
- `apps/web/src/features/team-builder/components/guided/concept-tooltip.tsx`
- `apps/web/src/features/team-builder/components/guided/role-suggestion-banner.tsx`
- `apps/web/src/features/team-builder/components/guided/ask-pecharunt-button.tsx`

### Full rewrites (2)
- `apps/web/src/features/team-builder/hooks/use-guided-builder.ts`
- `apps/web/src/features/team-builder/components/guided-builder.tsx`

### Modified (7)
- `apps/web/src/app/teams/[teamId]/guided/page.tsx` — wider container, formatId prop, removed header freeform button
- `apps/web/src/app/teams/new/page.tsx` — guided mode description text
- `packages/llm/src/context-builder.ts` — `GuidedBuilderContext`, enhanced `buildPageContextPrompt()`
- `apps/web/src/features/team-builder/components/core-picker.tsx` — `CorePokemon` -> `GuidedPokemonPick`
- `apps/web/src/features/team-builder/components/role-selector.tsx` — type updates, local `RoleDefinition`
- `apps/web/src/features/chat/context/chat-provider.tsx` — `pendingInput`, `openSidebar(message?)`, `clearPendingInput()`
- `apps/web/src/features/chat/components/chat-input.tsx` — consume `pendingInput`, pre-fill textarea
- `apps/web/src/features/chat/components/chat-panel.tsx` — pass `pendingInput`/`clearPendingInput` to ChatInput

## Known issues & next steps

- **Ability descriptions missing** — `simplified-set-editor.tsx` shows ability names but no descriptions (e.g., "Intimidate: Lowers opponent's Attack"). Could fetch from `@nasty-plot/pokemon-data` and add tooltips.
- **No Vitest tests for `use-guided-builder.ts`** — Phase 5 of the plan called for tests covering step transitions, recommendation fetching, and draft persistence. These were not written.
- **No end-to-end testing** — The full flow (create team -> guided build -> save) hasn't been manually tested with a running dev server + seeded database.
- **Draft-DB sync on refresh** — When a user restores from a draft, all slots are re-persisted to DB via the sync effect. If the DB already has different slots (e.g., user modified in freeform then came back to guided), the sync could overwrite freeform changes. Consider adding a conflict detection mechanism.
- **`saveAllSlots` is sequential** — Each slot is saved one at a time. Could parallelize with `Promise.allSettled` for faster save, but sequential is safer for SQLite.
- **Sample team import UX delay** — Persisting 6 slots sequentially before the UI transitions takes ~200-300ms. Could add a loading indicator to `StepStart` during import.

## Tech notes

- **`TeamSlotInput = Omit<TeamSlotData, "species" | "calculatedStats">`** — used for all slot API calls. Moves type is `[string, string?, string?, string?]` — `[""]` is valid.
- **`@pkmn/dex` species lookup** — the recommendation and analysis services call `Dex.species.get(pokemonId)` server-side to hydrate species data. This works because `@pkmn/dex` is bundled in the Node.js runtime.
- **React Query cache invalidation chain** — `useAddSlot`/`useUpdateSlot` mutations invalidate `["team", teamId]` on success. The guided builder's queries use separate keys (`["guided-recommendations", ...]`, `["guided-analysis", ...]`) that are NOT invalidated by slot mutations. They refetch based on `slotFingerprint` changes in local state.
- **Chat provider's `pendingInput` flow** — `openSidebar("question")` -> sets `pendingInput` in provider state -> `ChatPanel` reads it and passes to `ChatInput` as prop -> `ChatInput`'s `useEffect` sets `textareaRef.current.value` and calls `clearPendingInput()`. The textarea uses a ref, not controlled state, so DOM manipulation is required.
- **`removeSlot` renumbers positions** — The team service's `removeSlot` function deletes a slot and renumbers remaining positions. This is why the guided builder avoids removal during building (uses upsert instead).
