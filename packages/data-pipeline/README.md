# @nasty-plot/data-pipeline

Data seeding CLI and staleness detection. Seeds the SQLite database with Smogon usage stats, recommended sets, and sample teams.

## Key Exports

- **`isStale(formatId)`** -- checks if cached data for a format needs re-syncing
- **`seedSampleTeams()`** -- imports sample teams into the database

## CLI Scripts

```bash
pnpm seed    # runs src/cli/seed.ts to sync all format data from Smogon
pnpm clean   # runs src/cli/clean.ts to clear seeded data
```

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/formats`, `@nasty-plot/smogon-data`, `@nasty-plot/teams`

## Usage

```typescript
import { isStale } from "@nasty-plot/data-pipeline"

if (await isStale("gen9ou")) {
  // Trigger re-sync via API or CLI
}
```
