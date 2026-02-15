# @nasty-plot/formats

Format definitions and legality checking for Smogon singles tiers (OU, UU, etc.) and VGC doubles. Manages which Pokemon, moves, and items are legal in each competitive format.

## Key Exports

- **Definitions** -- `FORMAT_DEFINITIONS` (static format metadata)
- **Lookup** -- `getFormat()`, `listFormats()`, `getActiveFormats()`
- **Legality** -- `isLegalInFormat()`, `getFormatPokemon()`, `getFormatItems()`, `getFormatMoves()`, `getFormatLearnset()`
- **Resolution** -- `resolveFormatId()`, `getFormatFallbacks()`
- **DB Sync** -- `ensureFormatExists()` (upserts format into the database)

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/pokemon-data`

## Usage

```typescript
import { getFormat, isLegalInFormat, getFormatPokemon } from "@nasty-plot/formats"

const ou = getFormat("gen9ou")
const legal = isLegalInFormat("greatTusk", "gen9ou") // true
const pokemonList = await getFormatPokemon("gen9ou")
```
