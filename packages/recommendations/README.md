# @nasty-plot/recommendations

Pokemon recommendations for team building, combining coverage-based, usage-based, and composite scoring strategies.

## Key Exports

- **`getRecommendations()`** -- composite recommendations blending multiple strategies
- **`getCoverageBasedRecommendations()`** -- recommends Pokemon that fill type coverage gaps
- **`getUsageBasedRecommendations()`** -- recommends Pokemon based on Smogon usage/teammate correlations

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/analysis`, `@nasty-plot/pokemon-data`, `@nasty-plot/smogon-data`, `@nasty-plot/teams`

## Usage

```typescript
import { getRecommendations } from "@nasty-plot/recommendations"

const recs = await getRecommendations(teamId, "gen9ou", { limit: 10 })
// Returns ranked Pokemon suggestions with scores and reasoning
```
