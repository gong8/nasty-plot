# @nasty-plot/damage-calc

Wrapper around `@smogon/calc` for damage calculation and matchup matrices.

## Key Exports

- **`calculateDamage()`** -- single damage calculation between two Pokemon
- **`calculateMatchupMatrix()`** -- team vs team damage matrix
- **`calculateQuickDamage()`** -- lightweight damage estimate
- **`flattenDamage()`** -- converts damage result to a simplified numeric format

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/pokemon-data`
- `@smogon/calc`

## Usage

```typescript
import { calculateDamage, calculateMatchupMatrix } from "@nasty-plot/damage-calc"

const result = calculateDamage(attacker, defender, move)
const matrix = calculateMatchupMatrix(team1Slots, team2Slots)
```

## Notes

- `@smogon/calc` requires display names (`"Great Tusk"`) not IDs (`"greatTusk"`). This package handles the conversion internally.
