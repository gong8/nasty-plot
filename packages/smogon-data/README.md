# @nasty-plot/smogon-data

Fetches, caches, and queries Smogon usage statistics, recommended sets, teammate correlations, and move/item/ability usage from `@pkmn/smogon`.

## Key Exports

- **Usage Stats** -- `syncUsageStats()`, `getUsageStats()`, `getUsageStatsCount()`, `getTopPokemon()`, `getUsageForPokemon()`
- **Smogon Sets** -- `syncSmogonSets()`, `getSetsForPokemon()`, `getAllSetsForFormat()`, `getNatureUsage()`
- **Teammates** -- `getTeammates()`, `getTopCores()`
- **Item/Move/Ability Usage** -- `getMoveUsage()`, `getItemUsage()`, `getAbilityUsage()`
- **Set Inference** -- `inferFromSets()`, `enrichExtractedTeam()` (fill missing set data from Smogon defaults)
- **Sync** -- `fetchSmogonData()`, `upsertSyncLog()`, `getSyncLogs()`

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/formats`, `@nasty-plot/pokemon-data`
- `@pkmn/smogon`

## Usage

```typescript
import { getTopPokemon, getSetsForPokemon } from "@nasty-plot/smogon-data"

const top = await getTopPokemon("gen9ou", 20)
const sets = await getSetsForPokemon("greatTusk", "gen9ou")
```
