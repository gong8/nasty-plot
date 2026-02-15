# @nasty-plot/analysis

Type coverage analysis, threat identification, and synergy scoring for Pokemon teams.

## Key Exports

- **`analyzeTeam()`** -- full team analysis combining coverage, threats, and synergy
- **`analyzeTypeCoverage()`** -- offensive/defensive type coverage for a team
- **`identifyThreats()`** -- identifies top threats the team is weak to
- **`calculateSynergy()`** -- scores type and role synergy between team members

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/formats`, `@nasty-plot/pokemon-data`, `@nasty-plot/smogon-data`, `@nasty-plot/teams`

## Usage

```typescript
import { analyzeTeam, analyzeTypeCoverage } from "@nasty-plot/analysis"

const analysis = await analyzeTeam(teamId, "gen9ou")
const coverage = analyzeTypeCoverage(teamSlots)
```
