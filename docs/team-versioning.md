# Team Versioning: Git-Style Team Management

## Motivation

Competitive Pokemon team building is inherently iterative. You build a team, test it on ladder, identify weaknesses, make adjustments, and repeat. This build-test-tweak loop produces a natural history of team evolution -- but today, every edit is destructive. Change your Toxapex to a Slowking and the original is gone.

Git solved this exact problem for source code. Teams are small, structured documents -- far simpler than codebases -- making them ideal candidates for version control semantics without the complexity of a full VCS.

### Use Cases

**Experimentation without risk.** "I want to try replacing Toxapex with Slowking-Galar for future sight support, but I don't want to lose my current build." Fork the team, make the change, test both. Keep the winner.

**Variant comparison.** "I built three variants of my rain team -- one with Barraskewda, one with Arctozolt, one with Floatzel. Which performs best?" Fork from the base rain core, customize each, run batch simulations against the OU meta, compare win rates side by side.

**History tracking.** "My team evolved over two weeks of iteration -- Tera types changed, EV spreads got optimized, entire members got swapped. I want to see how it got here." The lineage tree shows every fork point and the changes at each step.

**Tournament snapshots.** "I want to compare my pre-tournament version with the post-tournament version I adapted after round 3." Fork before the tournament, make live adjustments to the fork during the event, diff afterward to see exactly what changed and why.

**Collaborative building.** Two players working from the same base team can each fork, experiment independently, then merge the best ideas from each branch into a final version.

## Data Model

### Schema Changes

The existing `Team` model gets three new columns:

```prisma
model Team {
  // --- existing fields ---
  id        String   @id @default(uuid())
  name      String
  formatId  String
  mode      String   @default("freeform")
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // --- new versioning fields ---
  parentId   String?   // Fork source (null = original/root team)
  branchName String?   // User label: "ice-coverage-variant", "anti-rain", etc.
  isArchived Boolean   @default(false)

  // --- relations ---
  format         Format        @relation(fields: [formatId], references: [id])
  slots          TeamSlot[]
  chatSessions   ChatSession[]
  battlesAsTeam1 Battle[]      @relation("BattleTeam1")
  battlesAsTeam2 Battle[]      @relation("BattleTeam2")
  parent         Team?         @relation("TeamLineage", fields: [parentId], references: [id], onDelete: SetNull)
  children       Team[]        @relation("TeamLineage")

  @@index([parentId])
}
```

**`parentId`**: Points to the team this one was forked from. `null` means it is a root team (created from scratch or imported). This single field creates a tree structure.

**`branchName`**: Optional human-readable label for the variant. Not an identifier -- just a description. Examples: `"anti-rain"`, `"trick room pivot"`, `"post-round-3"`. If unset, the UI can display the team name or auto-generate a label.

**`isArchived`**: Soft delete. Archived teams are hidden from the default team list but remain in the database so lineage references stay valid. Can be permanently purged later via a maintenance job.

### Design Decision: Full Copy, Not Diffs

Each team version is a complete, self-contained copy of all team data. There is no diff chain to reconstruct from.

**Why full copies?**

- **Teams are small.** 6 slots x ~15 fields each = ~100 fields per team. A full team row with all slots is under 5KB in SQLite. Even 100 versions of a team costs less than 500KB.
- **Self-contained reads.** `SELECT * FROM Team WHERE id = ? INCLUDE slots` gives you the complete team. No need to walk a diff chain, apply patches, or handle merge conflicts in storage.
- **Simple deletes.** Archiving or purging one version has no effect on other versions. No orphaned diffs.
- **Diff is computed, not stored.** When comparing two teams, the diff is calculated at read time from the two full snapshots. This is cheap -- comparing 6 slots is trivial.
- **No schema complexity.** Diff-based approaches require a `TeamChange` table with polymorphic field tracking. Full copies reuse the existing `Team` + `TeamSlot` tables without modification.

The tradeoff is storage, but at <5KB per team in SQLite, this is a non-issue until thousands of versions exist per team -- and even then, it is megabytes, not gigabytes.

### Soft Delete Semantics

Hard deletion of teams breaks lineage trees. If team B was forked from team A, and you delete A, the lineage is severed.

Instead:

- `isArchived = true` hides the team from the default list view.
- Archived teams remain queryable for lineage visualization and diff operations.
- A separate `purgeArchivedTeams(olderThan: Date)` function can permanently delete archived teams (and their slots, cascading) when needed.
- The `onDelete: SetNull` on the `parent` relation means even if a parent is hard-deleted, the child's `parentId` becomes `null` rather than cascading the delete. The child becomes a new root.

## Type Definitions

These types live in `packages/core/src/types.ts` alongside the existing `TeamData` and `TeamSlotData`:

```typescript
// --- Team Versioning ---

/** Extended TeamData with versioning fields */
interface TeamData {
  // ... existing fields ...
  parentId?: string
  branchName?: string
  isArchived?: boolean
}

/** Diff between two teams */
interface TeamDiff {
  teamAId: string
  teamBId: string
  teamAName: string
  teamBName: string
  added: TeamSlotData[] // Pokemon in B not in A
  removed: TeamSlotData[] // Pokemon in A not in B
  changed: SlotChange[] // Same Pokemon, different config
  unchanged: string[] // pokemonIds that are identical in both
  summary: DiffSummary
}

/** Changes to a single slot between two versions */
interface SlotChange {
  pokemonId: string
  name: string // Display name for UI
  changes: FieldChange[]
}

/** A single field difference */
interface FieldChange {
  field: string // "ability", "item", "evs.atk", "moves[2]", etc.
  label: string // Human-readable: "Ability", "Attack EVs", "Move 3"
  before: string | number
  after: string | number
}

/** High-level diff statistics */
interface DiffSummary {
  totalChanges: number
  slotsAdded: number
  slotsRemoved: number
  slotsChanged: number
  slotsUnchanged: number
}

/** Per-slot merge decision */
interface MergeDecision {
  pokemonId: string
  source: "teamA" | "teamB" // Which version to keep for this slot
}

/** Options for the merge operation */
interface MergeOptions {
  name?: string // Name for the merged team (defaults to "Merge of A + B")
  branchName?: string
  notes?: string
}

/** Options for the fork operation */
interface ForkOptions {
  name?: string // Defaults to "{originalName} (fork)"
  branchName?: string
  notes?: string
  modifySlots?: Partial<TeamSlotInput>[] // Apply changes atomically during fork
}

/** A node in the team lineage tree */
interface LineageNode {
  teamId: string
  name: string
  branchName?: string
  parentId: string | null
  children: LineageNode[]
  createdAt: string
  isArchived: boolean
  slotCount: number // Quick visual indicator
  pokemonIds: string[] // For thumbnail sprites in the tree view
}
```

## Operations

### Fork (Create Variant)

Forking creates a deep copy of a team with `parentId` pointing back to the original.

```typescript
// packages/teams/src/version.service.ts

async function forkTeam(teamId: string, options?: ForkOptions): Promise<TeamData>
```

**Behavior:**

1. Load the source team with all slots.
2. Create a new `Team` row with:
   - `parentId = teamId`
   - `name = options.name ?? "{sourceName} (fork)"`
   - `branchName = options.branchName ?? null`
   - `formatId`, `mode` copied from source
   - `notes = options.notes ?? null`
3. Deep copy all `TeamSlot` rows to the new team, preserving positions.
4. If `options.modifySlots` is provided, apply modifications to the copied slots before returning. This enables atomic "fork + tweak" in one operation -- e.g., fork and swap one Pokemon.
5. Return the new team.

**Implementation notes:**

- Uses a Prisma transaction to ensure atomicity: either the full fork succeeds or nothing is created.
- The `domainSlotToDb` helper already exists in `team.service.ts` and is reused for slot copying.
- Slot IDs are auto-incremented, so the copied slots get new IDs. Only the team-level data references the parent.

**Edge cases:**

- Forking a team with 0 slots: valid. Creates an empty team linked to the parent.
- Forking an archived team: valid. The fork itself is not archived.
- `parentId` references are one level deep. If you fork a fork, the new team's `parentId` points to the immediate parent, not the root. The `getLineageTree` function reconstructs the full ancestry.

### Compare (Diff Two Teams)

Comparing produces a structured diff between any two teams. They do not need to be in the same lineage -- you can diff any team against any other team.

```typescript
function compareTeams(teamA: TeamData, teamB: TeamData): TeamDiff
```

**Matching strategy:**

Slots are matched by `pokemonId`, not by `position`. This is important because:

- A player might reorder their team (move the lead from position 1 to position 3) without changing the build. That should not show up as a change.
- Matching by `pokemonId` correctly identifies "same Pokemon, different config" vs "different Pokemon entirely."

**Algorithm:**

```
1. Build a map: pokemonId -> TeamSlotData for each team
2. For each pokemonId in teamA:
   a. If not in teamB: add to `removed`
   b. If in teamB: compare all fields. If identical, add to `unchanged`.
      If different, compute FieldChange[] and add to `changed`.
3. For each pokemonId in teamB not in teamA: add to `added`
4. Compute DiffSummary counts
```

**Field comparison details:**

| Field      | Comparison                      | FieldChange.field format         |
| ---------- | ------------------------------- | -------------------------------- |
| ability    | string equality                 | `"ability"`                      |
| item       | string equality                 | `"item"`                         |
| nature     | string equality                 | `"nature"`                       |
| teraType   | string equality (both nullable) | `"teraType"`                     |
| level      | numeric equality                | `"level"`                        |
| moves[0-3] | per-index string equality       | `"moves[0]"`, `"moves[1]"`, etc. |
| evs.hp-spe | per-stat numeric equality       | `"evs.hp"`, `"evs.atk"`, etc.    |
| ivs.hp-spe | per-stat numeric equality       | `"ivs.hp"`, `"ivs.atk"`, etc.    |
| nickname   | string equality (both nullable) | `"nickname"`                     |

**Duplicate pokemonId handling:** A team can technically have two of the same species (e.g., two Rotom forms with the same `pokemonId`). In practice, Species Clause prevents this in standard formats. If it occurs, the comparison falls back to position-based matching for duplicates within the same pokemonId.

### Merge (Manual, UI-Driven)

Merge creates a new team by selecting slots from two source teams on a per-Pokemon basis.

```typescript
async function mergeTeams(
  teamAId: string,
  teamBId: string,
  decisions: MergeDecision[],
  options?: MergeOptions,
): Promise<TeamData>
```

**Behavior:**

1. Load both teams.
2. Compute `compareTeams(teamA, teamB)` to understand the diff.
3. For each `MergeDecision`:
   - If `source === "teamA"`: copy the slot from teamA.
   - If `source === "teamB"`: copy the slot from teamB.
4. For `unchanged` Pokemon not explicitly in `decisions`: copy as-is (both teams have identical config).
5. For `added` Pokemon (only in B): include if a decision selects them; exclude otherwise.
6. For `removed` Pokemon (only in A): include if a decision selects them; exclude otherwise.
7. Create a new team with the assembled slots. `parentId` points to teamA (the "merge target").
8. Positions are assigned sequentially (1-6) based on the order of decisions.

**Why single-parent for merges?**

Prisma's relation model requires a single `parentId`. Supporting dual parents (true merge commits) would require either:

- An array relation (`parentIds String[]`), which SQLite does not support natively.
- A join table (`TeamParent` with `teamId` + `parentId`), adding schema complexity for a rare operation.

The pragmatic choice: the merge result's `parentId` points to teamA (the merge target), and the `notes` field records the merge source: `"Merged from {teamBName} ({teamBId})"`. The lineage tree shows the merge as a child of teamA with a note indicating teamB's contribution.

If dual-parent tracking becomes important later, a `TeamMerge` table can be added without breaking the single-parent tree:

```prisma
// Future: only add if needed
model TeamMerge {
  id        Int    @id @default(autoincrement())
  resultId  String // The merged team
  sourceAId String
  sourceBId String
  createdAt DateTime @default(now())

  @@unique([resultId])
}
```

### Lineage Tree

Retrieve the full family tree for any team, starting from its root ancestor.

```typescript
async function getLineageTree(teamId: string): Promise<LineageNode>
```

**Algorithm:**

1. Walk `parentId` chain upward to find the root (where `parentId === null`).
2. From the root, recursively load all children using `prisma.team.findMany({ where: { parentId: rootId } })`.
3. Build the tree structure as nested `LineageNode` objects.
4. Include lightweight data: name, branch name, creation date, archived status, slot count, and pokemonIds (for sprite thumbnails).

**Performance consideration:** For deeply forked teams, this could involve many queries. An optimization is to load all teams in the lineage with a single query:

```typescript
// Load all teams that share the same root
const root = await walkToRoot(teamId)
const allInLineage = await prisma.team.findMany({
  where: {
    OR: [
      { id: root.id },
      { parentId: root.id },
      // This only gets direct children of root.
      // For deeper trees, use a recursive approach.
    ],
  },
  include: { slots: { select: { pokemonId: true } } },
})
```

SQLite does not support recursive CTEs in Prisma, so the recursive fetch is done in application code. Given that team lineage trees are unlikely to exceed ~20-50 nodes, this is acceptable. If trees grow large, a `rootId` column can be added to enable single-query loading of all nodes in a lineage.

### Team History

A flat, ordered view of a team's ancestry -- useful for "how did this team evolve?"

```typescript
async function getTeamHistory(teamId: string): Promise<TeamData[]>
```

Returns an ordered list from root to the specified team, following the `parentId` chain. Each entry is a full `TeamData` with slots, allowing the UI to show incremental diffs between consecutive versions.

### Archive

Soft delete a team, hiding it from default views but preserving lineage.

```typescript
async function archiveTeam(teamId: string): Promise<void>
```

Sets `isArchived = true`. The `listTeams` function is updated to exclude archived teams by default, with an opt-in `includeArchived` filter:

```typescript
async function listTeams(filters?: {
  formatId?: string
  includeArchived?: boolean
}): Promise<TeamData[]>
```

## Service Layer

### File: `packages/teams/src/version.service.ts`

```typescript
// Public API

export async function forkTeam(teamId: string, options?: ForkOptions): Promise<TeamData>

export function compareTeams(teamA: TeamData, teamB: TeamData): TeamDiff

export async function mergeTeams(
  teamAId: string,
  teamBId: string,
  decisions: MergeDecision[],
  options?: MergeOptions,
): Promise<TeamData>

export async function getLineageTree(teamId: string): Promise<LineageNode>

export async function getTeamHistory(teamId: string): Promise<TeamData[]>

export async function archiveTeam(teamId: string): Promise<void>

export async function restoreTeam(teamId: string): Promise<void>
```

**Barrel export** from `packages/teams/src/index.ts`:

```typescript
export {
  forkTeam,
  compareTeams,
  mergeTeams,
  getLineageTree,
  getTeamHistory,
  archiveTeam,
  restoreTeam,
} from "./version.service"

export type {
  TeamDiff,
  SlotChange,
  FieldChange,
  DiffSummary,
  MergeDecision,
  MergeOptions,
  ForkOptions,
  LineageNode,
} from "@nasty-plot/core"
```

### Internal Helpers

`compareTeams` is a pure function -- no database access. It takes two `TeamData` objects and returns a `TeamDiff`. This makes it testable without mocking the database and reusable for both the API route and the merge operation (which calls `compareTeams` internally).

The slot-copying logic in `forkTeam` reuses the existing `domainSlotToDb` helper from `team.service.ts`. To avoid duplication, that helper is exported from `team.service.ts` (currently it is a module-private function).

## API Routes

### `POST /api/teams/[teamId]/fork`

Fork a team. Body:

```typescript
{
  name?: string;
  branchName?: string;
  notes?: string;
  modifySlots?: Partial<TeamSlotInput>[];
}
```

Response: `201 Created` with the new `TeamData`.

### `GET /api/teams/compare?a={teamAId}&b={teamBId}`

Compare two teams. Both query params required.

Response: `200 OK` with `TeamDiff`.

### `POST /api/teams/merge`

Merge two teams. Body:

```typescript
{
  teamAId: string;
  teamBId: string;
  decisions: MergeDecision[];
  name?: string;
  branchName?: string;
  notes?: string;
}
```

Response: `201 Created` with the new merged `TeamData`.

### `GET /api/teams/[teamId]/lineage`

Get the full lineage tree for a team.

Response: `200 OK` with `LineageNode` (tree structure, rooted at the oldest ancestor).

### `POST /api/teams/[teamId]/archive`

Archive a team (soft delete).

Response: `200 OK`.

### `POST /api/teams/[teamId]/restore`

Restore an archived team.

Response: `200 OK`.

## UI Design

### Fork Button

A prominent "Fork" button on the team editor page (`/teams/[teamId]`), placed alongside the existing save and export actions. Clicking it opens a modal:

- **Name field:** pre-filled with `"{teamName} (fork)"`, editable.
- **Branch label field:** optional, placeholder text: `"e.g., anti-stall variant"`.
- **Notes field:** optional, multi-line.
- **"Fork & Edit" button:** creates the fork and navigates to the new team's editor.

### Compare View

Accessible from a dropdown on the team editor page: "Compare with..." lists all teams in the same lineage (siblings, parent, children). Selecting one opens the diff view.

**Side-by-side layout:**

```
+---------------------------+---------------------------+
|  Rain Team v1 (original)  |  Rain Team v2 (fork)      |
+---------------------------+---------------------------+
|  Pelipper                 |  Pelipper                 |
|    Drizzle / Damp Rock    |    Drizzle / Damp Rock    |
|    (unchanged)            |    (unchanged)            |
+---------------------------+---------------------------+
|  Barraskewda              |  [REMOVED]                |
|    Swift Swim / ...       |                           |
+---------------------------+---------------------------+
|                           |  Arctozolt    [ADDED]     |
|                           |    Slush Rush / ...       |
+---------------------------+---------------------------+
|  Ferrothorn               |  Ferrothorn               |
|    Iron Barbs / Leftovers |    Iron Barbs / Rocky Helmet|
|    EV: 252 HP / 88 Def /  |    EV: 252 HP / 168 Def / |
|        168 SpD            |        88 SpD             |
+---------------------------+---------------------------+
```

**Color coding:**

- Unchanged slots: neutral background.
- Changed fields: yellow highlight with before/after values.
- Added Pokemon (in B not A): green background on the right, empty on the left.
- Removed Pokemon (in A not B): red background on the left, empty on the right.
- EV changes: displayed as deltas where helpful (`+80 Def, -80 SpD`).

### Merge Wizard

A multi-step flow:

**Step 1: Select teams.** Pick two teams from the lineage tree (or any two teams).

**Step 2: Review diff and choose.** For each Pokemon that differs, radio buttons: "Keep from Team A" / "Keep from Team B". Unchanged Pokemon are pre-selected and can be toggled.

**Step 3: Name and confirm.** Name the merged team, optionally add a branch label and notes. Preview the final team composition.

**Step 4: Result.** Navigate to the new merged team's editor.

### Lineage Tree Visualization

Displayed on the team page as a collapsible tree. Each node shows:

- Team name (clickable -- navigates to that team's editor)
- Branch label (if set), displayed as a tag
- Creation date
- Pokemon sprites (mini, from `@pkmn/img`) for quick visual identification
- Archived status (grayed out with strikethrough)
- Win rate badge (if batch simulation data exists for this team)

```
Rain Team (root)
  |
  +-- Rain v2 (ice coverage)
  |     |
  |     +-- Rain v3 (final) *
  |
  +-- Rain anti-stall
  |     |
  |     +-- Rain anti-stall v2
  |
  +-- Rain HO variant [archived]
```

The currently viewed team is highlighted with an asterisk or border.

**Implementation:** Rendered with nested `<div>` elements and CSS tree lines, or using a lightweight tree library. Mermaid diagrams are an option for the LLM chat context but not for the interactive UI.

## Integration with Simulation

The batch simulation system (`packages/battle-engine/src/simulation/batch-simulator.ts`) already supports running N games between two teams. Team versioning integrates with this:

### "Simulate Both" Button

On the compare view, a "Simulate Both Variants" button:

1. Exports both teams as Showdown paste (via `exportShowdownPaste`).
2. Prompts for an opponent team (or uses a meta-representative sample).
3. Runs batch simulation for both variants against the same opponent, same AI difficulty, same game count.
4. Displays results side by side:

```
              Rain v1        Rain v2 (ice coverage)
Win Rate:     62.3%          68.7%  (+6.4%)
Avg Turns:    28.1           24.3   (-3.8)
MVP:          Barraskewda    Arctozolt
```

5. Per-Pokemon performance breakdown: KOs, faints, average HP remaining.

### Lineage + Simulation Data

The lineage tree can display win rate badges on each node if simulation data exists. This creates a visual "which version performs best?" overview across the entire team history.

To avoid running expensive simulations repeatedly, results are cached via the existing `BatchSimulation` model (which stores `team1Wins`, `team2Wins`, `draws`, and per-battle records).

## Migration Path

### Database Migration

```sql
-- Add versioning columns to Team table
ALTER TABLE Team ADD COLUMN parentId TEXT;
ALTER TABLE Team ADD COLUMN branchName TEXT;
ALTER TABLE Team ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0;

-- Index for efficient lineage queries
CREATE INDEX idx_team_parentId ON Team(parentId);

-- Foreign key (SQLite requires PRAGMA foreign_keys = ON)
-- Prisma handles this via the relation definition
```

### Backward Compatibility

- **Existing teams** get `parentId = null`, `branchName = null`, `isArchived = false`. They are root teams with no lineage. No data migration needed beyond adding the columns.
- **Existing API routes** are unchanged. `GET /api/teams` continues to work, now filtering out archived teams by default.
- **Team list UI** works as before. The fork button and compare dropdown are additive -- they don't replace existing functionality.
- **`TeamData` type changes** are backward-compatible: all new fields are optional.

### Rollout Phases

**Phase 1: Fork + Archive.** Add the schema columns, implement `forkTeam` and `archiveTeam`, add the fork button to the UI. This is the most valuable feature with the least complexity.

**Phase 2: Compare.** Implement `compareTeams` and the side-by-side diff view. Pure function, no schema changes needed beyond Phase 1.

**Phase 3: Lineage.** Implement `getLineageTree` and the tree visualization. Requires recursive querying but no schema changes.

**Phase 4: Merge.** Implement `mergeTeams` and the merge wizard. Most complex UI, least common operation. Can be deferred.

**Phase 5: Simulation integration.** Wire up batch simulation to the compare view. Depends on the existing simulation infrastructure being stable.

## Testing Strategy

### Unit Tests

`compareTeams` is a pure function and the primary target for unit testing:

- Two identical teams produce empty diff (all `unchanged`).
- Completely different teams produce all `added` + all `removed`.
- Single field change (e.g., item swap) produces one `SlotChange` with one `FieldChange`.
- EV spread change produces multiple `FieldChange` entries under one `SlotChange`.
- Move order changes: `["Earthquake", "Ice Punch"]` vs `["Ice Punch", "Earthquake"]` -- these are position-sensitive and should produce changes.
- Duplicate `pokemonId` handling (two Rotom forms).
- Null/undefined field handling (`teraType` set vs unset).

### Integration Tests

- `forkTeam`: verify the new team has a different ID, correct `parentId`, identical slots.
- `forkTeam` with `modifySlots`: verify the modifications are applied.
- `archiveTeam` + `listTeams`: verify archived teams are excluded by default, included with flag.
- `getLineageTree`: create a 3-level lineage (root -> fork -> fork-of-fork), verify tree structure.
- `mergeTeams`: verify the merged team has the correct slots based on decisions.

### Test Fixtures

Reuse the existing test patterns from `tests/teams/team.service.test.ts`. Create two fixed team fixtures with known differences for deterministic diff testing.

## Open Questions

**1. Should branch names be unique within a lineage?** Currently no -- they are labels, not identifiers. Two forks of the same team could both be named "anti-stall". This matches git (branch names are unique, but only because they are refs, not labels). For Nasty Plot, team names already serve as the unique-enough identifier.

**2. Auto-snapshot on save?** Should every save of a team automatically create a new version (fork from previous state)? This would provide complete history but create many versions. A middle ground: offer an explicit "Save as new version" checkbox alongside the normal save, defaulting to off.

**3. Diff by pokemonId vs. position?** The current design matches by `pokemonId`. An alternative: match by position (slot 1 to slot 1, slot 2 to slot 2). Position-based matching would treat "reorder the team" as changes, but "swap Toxapex for Slowking in slot 4" as a single slot change. The `pokemonId` approach treats reordering as no-change (correct for builds) but cannot diff two completely different teams meaningfully. The `pokemonId` matching is better for the primary use case (comparing variants of the same core).

**4. Maximum lineage depth?** No hard limit, but the UI tree view should collapse branches deeper than ~5 levels by default to stay readable. Recursive queries should have a safety limit (e.g., 100 ancestors max in `getTeamHistory`).

**5. Cross-format forking?** Should you be able to fork a Gen 9 OU team into a Gen 9 UU team? This is a valid use case (porting a team down a tier) but complicates the comparison -- the fork would differ in `formatId`, and legality rules would change. Initial implementation: allow it, but mark format changes in the diff.
