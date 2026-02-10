# Session: Add db:clean script for user data

**Date:** 2026-02-10
**Duration context:** Short

## What was accomplished

- Created `pnpm db:clean` script to delete all user-generated data from the database while preserving seeded reference data (formats, usage stats, Smogon sets, teammate correlations, check/counters, sync logs)
- Tables cleaned: `Team`, `TeamSlot`, `Battle`, `BattleTurn`, `BatchSimulation`, `ChatSession`, `ChatMessage`, `SampleTeam`
- Deletes run in a single Prisma transaction in dependency order (children before parents)

## Key decisions & rationale

- **Placed in `packages/data-pipeline/src/cli/clean.ts`** alongside the existing `seed.ts` — keeps data lifecycle scripts co-located
- **Root-level script named `db:clean`** (not just `clean`) to group it with other `db:*` commands (`db:generate`, `db:migrate`, `db:push`)
- **Included `SampleTeam` in the clean** — these are browsable example teams that could be user-imported or re-seeded, so they count as user-facing data rather than core reference data
- **Transaction-based deletion** — ensures all-or-nothing cleanup, no partial state if something fails mid-way

## Files changed

- `packages/data-pipeline/src/cli/clean.ts` — **created** — clean script implementation
- `packages/data-pipeline/package.json` — added `"clean"` script
- `package.json` — added root-level `"db:clean"` script

## Known issues & next steps

- If `SampleTeam` data is considered seeded (not user data), it could be excluded from the clean script — user can adjust as needed
- No confirmation prompt before deletion — could add one if accidental runs become a concern

## Tech notes

- Prisma `deleteMany()` in a `$transaction` array respects ordering, which matters for foreign key constraints (e.g. `BattleTurn` before `Battle`, `TeamSlot` before `Team`)
- `Team` has a self-referential `parentId` for lineage/forking — deleting all teams at once in a single `deleteMany` works fine since SQLite defers FK checks within transactions
