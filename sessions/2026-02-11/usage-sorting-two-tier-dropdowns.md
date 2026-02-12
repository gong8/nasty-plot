# Session: Usage-Based Sorting & Two-Tier Dropdowns

**Date:** 2026-02-11
**Duration context:** Medium

## What was accomplished

- Added 3 new Prisma models (`MoveUsage`, `ItemUsage`, `AbilityUsage`) to persist per-Pokemon move/item/ability usage percentages from Smogon chaos JSON
- Extended `fetchUsageStats()` in `smogon-data` to seed move, item, and ability usage data during the data pipeline
- Added query functions: `getMoveUsage()`, `getItemUsage()`, `getAbilityUsage()`, `getNatureUsage()`
- Created `GET /api/pokemon/[id]/popularity?format=...` endpoint returning all popularity data for a Pokemon
- Added `sort` query param to `GET /api/pokemon` API supporting `usage`, `name`, `bst`, `dex` modes
- Added sort selector dropdown to the Pokemon browser page with auto-switch to "usage" when a format is selected
- Created shared `usePopularityData` React Query hook for fetching popularity data
- Converted all dropdowns in the slot editor to two-tier "Common" / "All" sections:
  - **Items**: Common items with usage % / All Items
  - **Moves**: Common moves with usage % / All Moves
  - **Abilities**: Common with usage % / Other
  - **Natures**: Common (from SmogonSets) / All Natures
- Applied same two-tier changes to the guided builder's `SimplifiedSetEditor`
- Threaded `pokemonId` prop through to `ItemCombobox` from both `SlotEditor` and `SimplifiedSetEditor`
- Seeded all 12 active formats successfully (312-471 Pokemon per format)

## Key decisions & rationale

- **No year/month on usage tables**: Like `TeammateCorr`/`CheckCounter`, we only keep the latest data — simpler schema, no staleness complexity
- **Nature usage derived from SmogonSet rows** rather than a new table: SmogonSets already have nature data, just needed grouping/counting
- **Single `/popularity` endpoint** returns all 4 data types (moves, items, abilities, natures) in one call — avoids waterfall of 4 separate requests per Pokemon
- **Usage sort fetches all usage stats**: Uses `getUsageStats(formatId, { limit: 9999 })` and builds a rank map in memory. Acceptable because format usage stats are bounded (~300-500 Pokemon per format)
- **Common moves capped at 12**: Prevents the "Common" section from overwhelming the dropdown when a Pokemon has many viable moves

## Bugs found & fixed

- None — clean implementation

## Pitfalls & gotchas encountered

- Pre-commit hooks reverted file changes during `git stash` / `git stash pop` cycle (linter ran on stash pop and overwrote files). Had to verify changes were preserved after restore
- 3 pre-existing test failures in `tests/llm/chat.service.test.ts` (unrelated to this work — caused by uncommitted LLM changes on the branch)

## Files changed

| File                                                                             | Change                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `prisma/schema.prisma`                                                           | Added MoveUsage, ItemUsage, AbilityUsage models + Format relations |
| `prisma/migrations/20260211012542_add_move_item_ability_usage/`                  | New migration                                                      |
| `packages/smogon-data/src/usage-stats.service.ts`                                | Persist moves/items/abilities during seed; added 3 query functions |
| `packages/smogon-data/src/smogon-sets.service.ts`                                | Added `getNatureUsage()`                                           |
| `packages/smogon-data/src/index.ts`                                              | Exported new functions                                             |
| `apps/web/src/app/api/pokemon/[id]/popularity/route.ts`                          | **New** — popularity endpoint                                      |
| `apps/web/src/app/api/pokemon/route.ts`                                          | Added `sort` query param with usage/name/bst/dex modes             |
| `apps/web/src/app/pokemon/page.tsx`                                              | Added sort selector, auto-switch to usage on format select         |
| `apps/web/src/features/team-builder/hooks/use-popularity-data.ts`                | **New** — shared React Query hook                                  |
| `apps/web/src/features/team-builder/components/item-combobox.tsx`                | Two-tier with pokemonId prop                                       |
| `apps/web/src/features/team-builder/components/slot-editor.tsx`                  | Two-tier moves, abilities, natures; popularity data flow           |
| `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx` | Same two-tier changes for guided builder                           |

## Known issues & next steps

- **LLM test failures**: 3 tests in `tests/llm/chat.service.test.ts` are failing (pre-existing, related to uncommitted LLM/chat changes on the branch)
- **No tests for new code**: The new query functions, API endpoint, and popularity hook have no test coverage yet
- **Seeding performance**: Each Pokemon upserts moves/items/abilities individually — could be batched with `createMany` for faster seeding if needed
- **Usage sort is async now**: The Pokemon API route became async due to the usage stats DB query — worth monitoring for latency

## Tech notes

- **Smogon chaos JSON structure**: `data[pokemonName].Moves`, `.Items`, `.Abilities` are all `Record<string, number>` where the number is a raw usage count (not percentage). We store them as-is since they're proportional to usage
- **Nature usage is count-based**: Unlike moves/items/abilities which have float usage percentages, natures are derived by counting SmogonSet rows — the count represents how many recommended sets use that nature
- **`SelectGroup` + `SelectLabel`** from Radix UI Select is used for two-tier ability/nature selects; `CommandGroup` with `heading` prop is used for two-tier item combobox
- **Move dropdown** uses custom HTML sections (not Radix) since it's a custom autocomplete input, not a Command/Select component
