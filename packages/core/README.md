# @nasty-plot/core

Foundation package containing domain types, constants, and pure utility functions shared across all packages. Has zero internal dependencies.

## Key Exports

- **Types** -- `TeamSlotData`, `PokemonSpecies`, `StatsTable`, `NatureName`, `PokemonType`, `GameType`
- **Constants** -- `POKEMON_TYPES`, `DEFAULT_EVS`, `DEFAULT_IVS`, `DEFAULT_NATURE`, `DEFAULT_FORMAT_ID`
- **Type Chart** -- `getTypeEffectiveness()`, `getWeaknesses()`, `getOffensiveCoverage()`
- **Stat Calculator** -- `calculateStat()`, `calculateAllStats()`, `fillStats()`
- **Showdown Paste** -- `parseShowdownPaste()`, `exportShowdownPaste()`
- **Validation** -- `validateTeamSlot()`, `validateEvSpread()`
- **Env Config** -- `validateEnv()` for startup environment variable checks
- **Cache** -- `TtlCache` for in-memory TTL-based caching
- **Chat Context** -- context builder helpers for LLM integrations

## Dependencies

None (foundation layer).

## Usage

```typescript
import { parseShowdownPaste, getTypeEffectiveness, calculateAllStats } from "@nasty-plot/core"

const slots = parseShowdownPaste(pasteText)
const multiplier = getTypeEffectiveness("fire", ["grass", "steel"]) // 4
```
