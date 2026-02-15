# @nasty-plot/teams

Team CRUD operations, slot management, Showdown paste import/export, validation, sample teams, team matching, and versioning (fork, compare, merge).

## Key Exports

- **Team CRUD** -- `createTeam()`, `getTeam()`, `listTeams()`, `updateTeam()`, `deleteTeam()`, `cleanupEmptyTeams()`
- **Slot Management** -- `addSlot()`, `updateSlot()`, `removeSlot()`, `clearSlots()`, `reorderSlots()`
- **Import/Export** -- `importShowdownPaste()`, `importIntoTeam()`, `exportShowdownPaste()`, `createTeamFromExtractedData()`
- **Validation** -- `validateTeam()`
- **Sample Teams** -- `createSampleTeam()`, `listSampleTeams()`, `getSampleTeam()`, `deleteSampleTeam()`, `importSampleTeamsFromPastes()`, `extractPokemonIds()`, `toSampleTeamView()`
- **Team Matching** -- `fingerprintFromPaste()`, `fingerprintFromSlots()`, `fingerprintFromExtracted()`, `compareFingerprints()`, `findMatchingTeams()`
- **Versioning** -- `forkTeam()`, `compareTeams()`, `mergeTeams()`, `getLineageTree()`, `getTeamHistory()`, `archiveTeam()`, `restoreTeam()`
- **Mappers** -- `domainSlotToDb()`, `dbTeamToDomain()`, `dbSlotToDomain()`

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/formats`, `@nasty-plot/pokemon-data`

## Usage

```typescript
import { createTeam, addSlot, exportShowdownPaste } from "@nasty-plot/teams"

const team = await createTeam({ name: "My OU Team", formatId: "gen9ou" })
await addSlot(team.id, { position: 1, pokemonId: "greatTusk", moves: ["headlongRush"] })
const paste = await exportShowdownPaste(team.id)
```
