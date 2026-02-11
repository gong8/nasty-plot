# Battle History, Import & Export

## Context

We want to create a tighter optimization loop: play battles with a team, review battle history, and refine the team based on results. Currently battles store `team1Id`/`team2Id` FKs but there's no UI or API to query battles by team. There's also no way to import external Showdown replays or export battles. The battle engine already uses `@pkmn/sim` natively — protocol logs are in standard Showdown format, so compatibility is built-in.

**User requirements:**

- Dedicated sub-page at `/teams/[teamId]/battles` with full analytics
- Battle export in both raw `.log` and structured JSON formats
- Battle import from Showdown replay URLs and raw protocol log paste, living at `/battle/import`
- Smart team matching on import (species + moves, order-independent), auto-create team if no match
- Batch simulations in a separate section from individual battles
- Accessible from both team detail page and battle hub
- Protocol-level analysis (problem Pokemon, KO tracking) as a TODO stub for now

---

## Phase 1: Schema & Core Types

### 1a. Add `source` field to Team model

**File:** `prisma/schema.prisma` (Team model, ~line 90)

```prisma
model Team {
  ...
  source     String   @default("manual")  // "manual" | "imported"
  ...
}
```

**File:** `packages/core/src/types.ts`

- Add `source?: "manual" | "imported"` to `TeamData` and `TeamCreateInput`

**Migration:** `pnpm db:migrate` with name `add_team_source_field`

### 1b. Add indexes to Battle for team-based queries

**File:** `prisma/schema.prisma` (Battle model, ~line 211)

```prisma
@@index([team1Id])
@@index([team2Id])
```

**Migration:** `add_battle_team_indexes`

### 1c. Update team service to pass through `source`

**File:** `packages/teams/src/team.service.ts`

- `createTeam()`: accept and store `source` field
- `dbTeamToDomain()`: map `source` to domain object

---

## Phase 2: Battle Import Services (packages)

### 2a. Replay import parser

**New file:** `packages/battle-engine/src/replay/replay-import.ts`

Functions:

- `parseReplayUrl(url: string): string | null` — extract replay ID from `replay.pokemonshowdown.com/{id}` URLs
- `fetchShowdownReplay(replayId: string): Promise<ShowdownReplayJson>` — fetch JSON from `https://replay.pokemonshowdown.com/{id}.json`
- `parseProtocolLog(log: string): ParsedBattleImport` — single-pass extraction of teams, format, players, winner, turn count from raw protocol lines
- `importFromReplayUrl(url: string): Promise<ParsedBattleImport>` — orchestrator for URL import
- `importFromRawLog(log: string): ParsedBattleImport` — orchestrator for raw log paste

Key types:

```typescript
interface ShowdownReplayJson {
  id: string
  formatid: string
  players: [string, string]
  log: string
  uploadtime: number
  rating: number
}

interface ParsedBattleImport {
  source: "replay-url" | "raw-log"
  replayId: string | null
  formatId: string
  gameType: "singles" | "doubles"
  playerNames: [string, string]
  winnerId: "p1" | "p2" | "draw" | null
  turnCount: number
  protocolLog: string
  team1: ExtractedTeamData
  team2: ExtractedTeamData
  uploadTime: number | null
  rating: number | null
}

interface ExtractedTeamData {
  playerName: string
  pokemon: ExtractedPokemonData[] // species, revealed moves/ability/item/tera, level
}
```

Protocol parsing extracts data from: `|player|`, `|gametype|`, `|tier|`, `|poke|`, `|switch|`, `|move|`, `|-ability|`, `|-item|`, `|-enditem|`, `|-terastallize|`, `|turn|`, `|win|`, `|tie|`. Must handle nickname-to-species mapping via `|switch|` lines.

**Important limitation:** External replays only have _revealed_ data (moves used, abilities triggered, items shown). EVs, IVs, natures, and unplayed moves are unknown.

### 2b. Team matching service

**New file:** `packages/teams/src/team-matcher.service.ts`

Functions:

- `fingerprintFromPaste(paste: string): TeamFingerprint` — sorted species IDs + sorted moves per Pokemon
- `fingerprintFromSlots(slots: TeamSlotData[]): TeamFingerprint`
- `compareFingerprints(a, b): "exact" | "pokemon-match" | "none"`
- `findMatchingTeams(extracted: ExtractedTeamData, formatId?: string): Promise<TeamMatchResult[]>`

**Matching algorithm:**

1. Hard requirement: exact same set of Pokemon species (sorted, compared as sets)
2. Soft scoring: each revealed move must be a **subset** of the team's stored moveset (replays don't show all 4 moves)
3. Ignores EVs, IVs, natures, items, abilities — team identity = species + moves
4. Returns matches sorted by confidence (60% base for species match + up to 40% for move compatibility)

### 2c. Auto-create team from extracted data

**File:** `packages/teams/src/import-export.service.ts` (add function)

```typescript
export async function createTeamFromExtractedData(
  extracted: ExtractedTeamData,
  formatId: string,
  teamName?: string,
): Promise<TeamData>
```

Creates a Team with `source: "imported"`, populates slots with known data, uses defaults for unknowns (Hardy nature, default EVs/IVs, slot 0 ability if not revealed).

### 2d. Battle export formatters

**New file:** `packages/battle-engine/src/export/battle-export.service.ts`

- `formatShowdownLog(battle): string` — returns raw protocol log text (trivial — it's already stored in Showdown format)
- `formatShowdownReplayJSON(battle): ShowdownReplayJSON` — structured JSON matching Showdown's replay format

### 2e. Battle history analytics

**New file:** `packages/battle-engine/src/battle-history.service.ts`

```typescript
export function computeTeamBattleAnalytics(
  teamId: string,
  battles: BattleRecord[],
): TeamBattleAnalytics
```

Pure function. Iterates battles, determines which side the team was on, computes:

- Win/loss/draw counts + win rate
- Average turn count
- Battles by format breakdown
- Recent trend (last 20 battles with result + opponent + turns)
- Stubs for problem Pokemon analysis (TODO)

### 2f. Barrel exports

**File:** `packages/battle-engine/src/index.ts` — add exports for replay-import, battle-export, battle-history
**File:** `packages/teams/src/index.ts` — add exports for team-matcher

---

## Phase 3: API Routes

### 3a. Add `teamId` filter to GET /api/battles

**File:** `apps/web/src/app/api/battles/route.ts`

- Accept `teamId` query param
- Build `where: { OR: [{ team1Id: teamId }, { team2Id: teamId }] }` when present
- Include `team1Id`, `team2Id`, `batchId` in the select (currently missing)
- Pass `where` to both `findMany` and `count`

### 3b. Team battle stats endpoint

**New file:** `apps/web/src/app/api/teams/[teamId]/battles/stats/route.ts`

`GET /api/teams/[teamId]/battles/stats`

Fetches all battles for team, runs `computeTeamBattleAnalytics()`, returns:

```typescript
{
  totalBattles, wins, losses, draws, winRate, avgTurnCount,
  battlesByFormat: Record<string, { total, wins, losses }>,
  recentTrend: Array<{ battleId, result, turnCount, createdAt, opponentName }>,
  // ANALYSIS TODO: problemPokemon, pokemonPerformance
}
```

### 3c. Battle export endpoint

**New file:** `apps/web/src/app/api/battles/[battleId]/export/route.ts`

`GET /api/battles/[battleId]/export?format=showdown|json`

- `showdown` (default): raw protocol log as `text/plain` with `Content-Disposition: attachment; filename=battle-{id}.log`
- `json`: structured Showdown replay JSON as `application/json`

### 3d. Battle import endpoint

**New file:** `apps/web/src/app/api/battles/import/route.ts`

`POST /api/battles/import`

Request:

```typescript
{
  replayUrl?: string    // Showdown replay URL
  rawLog?: string       // Raw protocol log paste
  autoMatchTeams?: boolean  // default: true
  autoCreateTeams?: boolean // default: true
}
```

Pipeline: parse input → extract teams → match against existing teams → auto-create if no match → create Battle record with `mode: "imported"`

Response:

```typescript
{
  battle: { id, formatId, team1Name, team2Name, team1Id, team2Id, winnerId, turnCount },
  teamMatching: {
    team1: { action: "matched"|"created"|"skipped", teamId, teamName, confidence },
    team2: { action: "matched"|"created"|"skipped", teamId, teamName, confidence }
  }
}
```

---

## Phase 4: UI — Battle History Page

### 4a. React Query hooks

**New file:** `apps/web/src/features/battle/hooks/use-team-battles.ts`

- `useTeamBattles(teamId, page)` — fetches paginated battles for team via `GET /api/battles?teamId=X`
- `useTeamBattleStats(teamId)` — fetches aggregated stats via `GET /api/teams/[teamId]/battles/stats`

### 4b. Battle history page

**New file:** `apps/web/src/app/teams/[teamId]/battles/page.tsx`

Layout:

- Header: back button + team name + "Battle History"
- **Stats row:** Cards showing win rate, total battles, avg turns, win streak (using `useTeamBattleStats`)
- **Trend visualization:** Recent results as colored dots/bars (green=win, red=loss, gray=draw)
- **Tabs:**
  - **Individual Battles** — paginated list of battle cards, each showing: opponent name, result badge (Win/Loss/Draw), format, turn count, time ago, link to replay. Excludes batch battles (`batchId IS NULL`)
  - **Batch Simulations** — list of batch sim results involving this team (battles where `batchId IS NOT NULL`), grouped by batch
  - **Analysis** — placeholder with "ANALYSIS TODO" text for future protocol-level analysis

### 4c. Components

**New files in `apps/web/src/features/battle/components/`:**

- `BattleHistoryView.tsx` — main container with stats + tabs
- `BattleStatsCards.tsx` — row of stat summary cards
- `BattleHistoryList.tsx` — paginated battle card list with result badges
- `BattleExportDialog.tsx` — modal with Showdown Log / JSON tabs, preview textarea, download/copy buttons

### 4d. Team detail page link

**File:** `apps/web/src/app/teams/[teamId]/page.tsx`

Add a "Battles" button in the team header action bar (alongside Fork, Import, Export, etc.), linking to `/teams/[teamId]/battles`.

### 4e. Battle hub additions

**File:** `apps/web/src/app/battle/page.tsx`

- Add "Import Replay" card to the quick links grid, linking to `/battle/import`
- Add team filter dropdown above the "Recent Battles" section

---

## Phase 5: UI — Battle Import Page

### 5a. Import page

**New file:** `apps/web/src/app/battle/import/page.tsx`

Two tabs:

- **Showdown Replay URL** — input field + Import button. Validates URL format client-side.
- **Raw Log Paste** — textarea + optional format selector + Import button.

After successful import:

- Summary card with battle details (players, format, turns, winner)
- Team matching results (matched/created for each side, with links to teams)
- Action buttons: "View Replay" | "Go to Team"

### 5b. Import hook

**New file:** `apps/web/src/features/battle/hooks/use-battle-import.ts`

- `useBattleImport()` — mutation calling `POST /api/battles/import`

---

## Phase 6: Tests

**New test files:**

- `tests/battle-engine/replay-import.test.ts` — URL parsing, protocol log extraction, team data extraction, winner detection, edge cases (nicknames, partial teams, doubles)
- `tests/battle-engine/battle-export.test.ts` — log formatting, JSON formatting
- `tests/battle-engine/battle-history.test.ts` — analytics computation (win rate, trends, format breakdown)
- `tests/teams/team-matcher.test.ts` — fingerprinting, comparison, matching with real team data

---

## Implementation Order

```
Phase 1 (Schema) → Phase 2 (Services) → Phase 3 (APIs) → Phase 4+5 (UI) → Phase 6 (Tests)
```

Within Phase 2, services are independent and can be built in parallel:

- 2a (replay-import) + 2b (team-matcher) + 2d (battle-export) + 2e (battle-history) in parallel
- 2c (auto-create team) depends on 2b

Phase 3 APIs depend on Phase 2 services.
Phase 4/5 UI depends on Phase 3 APIs.
Tests can be written alongside each phase.

---

## New Files Summary

| File                                                             | Purpose                                     |
| ---------------------------------------------------------------- | ------------------------------------------- |
| `packages/battle-engine/src/replay/replay-import.ts`             | Showdown replay fetch + protocol log parser |
| `packages/battle-engine/src/export/battle-export.service.ts`     | Log + JSON export formatters                |
| `packages/battle-engine/src/battle-history.service.ts`           | Analytics aggregation                       |
| `packages/teams/src/team-matcher.service.ts`                     | Fingerprint-based team matching             |
| `apps/web/src/app/api/teams/[teamId]/battles/stats/route.ts`     | Team battle stats API                       |
| `apps/web/src/app/api/battles/[battleId]/export/route.ts`        | Battle export API                           |
| `apps/web/src/app/api/battles/import/route.ts`                   | Battle import API                           |
| `apps/web/src/app/teams/[teamId]/battles/page.tsx`               | Battle history sub-page                     |
| `apps/web/src/app/battle/import/page.tsx`                        | Battle import page                          |
| `apps/web/src/features/battle/hooks/use-team-battles.ts`         | React Query hooks                           |
| `apps/web/src/features/battle/hooks/use-battle-import.ts`        | Import mutation hook                        |
| `apps/web/src/features/battle/components/BattleHistoryView.tsx`  | Main history container                      |
| `apps/web/src/features/battle/components/BattleStatsCards.tsx`   | Stats cards                                 |
| `apps/web/src/features/battle/components/BattleHistoryList.tsx`  | Battle list                                 |
| `apps/web/src/features/battle/components/BattleExportDialog.tsx` | Export dialog                               |
| `tests/battle-engine/replay-import.test.ts`                      | Import parser tests                         |
| `tests/battle-engine/battle-export.test.ts`                      | Export formatter tests                      |
| `tests/battle-engine/battle-history.test.ts`                     | Analytics tests                             |
| `tests/teams/team-matcher.test.ts`                               | Team matching tests                         |

## Modified Files Summary

| File                                          | Change                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `prisma/schema.prisma`                        | Add `source` to Team, indexes to Battle                                     |
| `packages/core/src/types.ts`                  | Add `source` to `TeamData` + `TeamCreateInput`                              |
| `packages/teams/src/team.service.ts`          | Pass through `source` field                                                 |
| `packages/teams/src/import-export.service.ts` | Add `createTeamFromExtractedData()`                                         |
| `packages/teams/src/index.ts`                 | Export team-matcher                                                         |
| `packages/battle-engine/src/index.ts`         | Export replay-import, battle-export, battle-history                         |
| `apps/web/src/app/api/battles/route.ts`       | Add `teamId` filter to GET, include `team1Id`/`team2Id`/`batchId` in select |
| `apps/web/src/app/teams/[teamId]/page.tsx`    | Add "Battles" button to header                                              |
| `apps/web/src/app/battle/page.tsx`            | Add "Import Replay" card + team filter                                      |

---

## Verification

1. **Schema migration:** `pnpm db:migrate` succeeds, existing teams get `source: "manual"` default
2. **Import from URL:** Paste a real Showdown replay URL (e.g. `https://replay.pokemonshowdown.com/gen9ou-XXXXX`) into `/battle/import`, verify battle is created with correct teams/winner/turns
3. **Import from raw log:** Paste raw protocol text, verify parsing and team extraction
4. **Team matching:** Import a replay where the player's team matches an existing team — verify it links correctly. Import one that doesn't match — verify team auto-creation with `source: "imported"`
5. **Battle history page:** Navigate to `/teams/[teamId]/battles` for a team with battles — verify stats, battle list, batch sim separation
6. **Export:** Click export on a battle, verify `.log` file is valid Showdown protocol and JSON matches expected shape
7. **Tests:** `pnpm test` passes for all new test files
