# Session: Team Versioning (NAS-21)

**Date:** 2026-02-10
**Duration context:** Long session — full feature implementation across all layers

## What was accomplished

- Implemented git-style team versioning: fork, compare, merge, lineage, archive/restore
- **Schema migration:** Added `parentId`, `branchName`, `isArchived` columns + `TeamLineage` self-relation to Team model
- **Core types:** Extended `TeamData`, added 8 new interfaces (`TeamDiff`, `SlotChange`, `FieldChange`, `DiffSummary`, `MergeDecision`, `MergeOptions`, `ForkOptions`, `LineageNode`)
- **team.service.ts updates:** Exported `domainSlotToDb`, updated `DbTeamRow`/`dbTeamToDomain` mapping, added `includeArchived` filter to `listTeams`, re-parent children on `deleteTeam`
- **version.service.ts (new):** 7 functions — `forkTeam`, `compareTeams`, `mergeTeams`, `getLineageTree`, `getTeamHistory`, `archiveTeam`, `restoreTeam`
- **6 new API routes:** fork, compare, merge, lineage, archive, restore + updated `/api/teams` GET with `includeArchived`
- **6 new React Query hooks:** `useForkTeam`, `useCompareTeams`, `useMergeTeams`, `useLineageTree`, `useArchiveTeam`, `useRestoreTeam`
- **UI components:** Fork modal on TeamHeader, Archive button on TeamHeader, `TeamDiffView` (side-by-side), `LineageTree` (recursive collapsible), `MergeWizard` (3-step dialog), Compare/Lineage tabs on team editor, archive toggle + restore on teams list
- **16 new tests** for version.service + **3 fixed existing tests** in team.service
- All 1206 tests pass across 44 files
- PR #1 created and merged to main

## Key decisions & rationale

- **Full-copy forking** (not diff-based): Each forked team is a complete copy of slots. Simpler to reason about, no dependency chain for reconstruction
- **pokemonId-based comparison** with position-based fallback for duplicates: Primary matching by pokemonId, falls back to array index when same Pokemon appears multiple times on a team
- **`prisma.$transaction`** for fork/merge atomicity: Prevents partial slot creation if something fails mid-operation
- **BFS batch-loading for lineage tree**: Avoids N+1 queries by collecting IDs at each level and batch-loading with `findMany`, 100-node safety limit
- **`onDelete: SetNull`** for parent relation + application-level re-parenting on delete: Preserves lineage chain when intermediate teams are deleted
- **Archive as soft-delete**: `isArchived` boolean rather than actual deletion, teams filtered out by default but restorable

## Bugs found & fixed

- **Prisma client stale after migration:** User hit `Unknown argument 'parentId'` error at runtime because the generated Prisma client didn't include the new schema fields. Fixed by running `pnpm db:generate` and restarting dev server (Turbopack caching gotcha)
- **3 existing tests broken by `listTeams` change:** Tests expected `where: undefined` but got `where: { isArchived: false }` after adding the archive filter. Also `deleteTeam` test failed because `prisma.team.updateMany` wasn't mocked (needed for re-parenting). Fixed all three.
- **Prisma migrate dev interactive prompt:** Command hung waiting for migration name input. Fixed by using `echo "name" | npx prisma migrate dev --name name`

## Pitfalls & gotchas encountered

- **Turbopack + Prisma cache:** After `prisma generate`, MUST restart the dev server. Turbopack caches the stale Prisma client and won't pick up schema changes until restarted. This is documented in CLAUDE.md but still caught us at runtime.
- **Prisma migrate dev is interactive:** The `--name` flag alone doesn't prevent the interactive prompt. Need to pipe input or use non-interactive mode.
- **MergeWizard initially not wired:** Component was fully built but never imported or rendered anywhere — caught during spec verification and fixed in a follow-up commit.
- **Archive button initially missing:** `useArchiveTeam` hook existed but no UI trigger — also caught during verification and fixed.

## Files changed

**New files (14):**

- `prisma/migrations/20260210155110_add_team_versioning/migration.sql`
- `packages/teams/src/version.service.ts`
- `tests/teams/version.service.test.ts`
- `apps/web/src/app/api/teams/[teamId]/fork/route.ts`
- `apps/web/src/app/api/teams/[teamId]/archive/route.ts`
- `apps/web/src/app/api/teams/[teamId]/restore/route.ts`
- `apps/web/src/app/api/teams/[teamId]/lineage/route.ts`
- `apps/web/src/app/api/teams/compare/route.ts`
- `apps/web/src/app/api/teams/merge/route.ts`
- `apps/web/src/features/team-builder/components/team-diff-view.tsx`
- `apps/web/src/features/team-builder/components/lineage-tree.tsx`
- `apps/web/src/features/team-builder/components/merge-wizard.tsx`

**Modified files (10):**

- `prisma/schema.prisma`
- `packages/core/src/types.ts`
- `packages/teams/src/team.service.ts`
- `packages/teams/src/index.ts`
- `apps/web/src/app/api/teams/route.ts`
- `apps/web/src/features/teams/hooks/use-teams.ts`
- `apps/web/src/features/team-builder/components/team-header.tsx`
- `apps/web/src/app/teams/page.tsx`
- `apps/web/src/app/teams/[teamId]/page.tsx`
- `tests/teams/team.service.test.ts`

## Known issues & next steps

- **Phase 7 (Simulation Integration) not started:** "Simulate Both Variants" button on compare view, lineage tree win rate badges. Requires batch simulation API integration.
- **`mergeTeams` duplicate edge case:** Doesn't de-duplicate if a MergeDecision targets an unchanged Pokemon. Unlikely in practice (UI prevents it) but theoretically possible via API.
- **Pre-existing build error:** `Cannot find name 'newSession'` in chat page — unrelated to versioning, prevents clean `pnpm build`.
- **Post-merge, main reverted some UI changes:** After PR merge, `team-header.tsx` and `[teamId]/page.tsx` appear to have been reverted (fork/archive buttons, lineage/compare tabs removed). The versioning backend (service, API routes, types, tests) is intact. The UI components (`team-diff-view.tsx`, `lineage-tree.tsx`, `merge-wizard.tsx`) exist but may need re-wiring.

## Tech notes

- **`compareTeams` is a pure function** — no DB access, takes two `TeamData` objects and returns a `TeamDiff`. Easy to unit test.
- **`FIELD_LABELS` map in version.service.ts** maps internal field paths (e.g., `evs.hp`, `moves[1]`) to human-readable labels (e.g., "HP EVs", "Move 2").
- **Lineage tree building:** Walk up parentId chain to find root, then BFS downward loading children in batches of 50 IDs. Safety limit of 100 nodes total.
- **TeamSlot storage reminder:** EVs/IVs are individual columns (`evHp`, `evAtk`...), moves are `move1`-`move4`. The `domainSlotToDb` function handles the mapping — that's why it was exported for use in version.service.ts.
- **Archive filtering default:** `listTeams()` without `includeArchived: true` automatically adds `where: { isArchived: false }`. All existing tests were updated for this.
