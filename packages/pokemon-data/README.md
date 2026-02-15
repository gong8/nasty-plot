# @nasty-plot/pokemon-data

Wrapper around `@pkmn/dex` and `@pkmn/data` providing typed access to Gen 9 Pokemon species, moves, abilities, items, learnsets, and sprite URLs.

## Key Exports

- **Species** -- `getSpecies()`, `listSpecies()`, `searchSpecies()`, `resolveSpeciesName()`, `enrichWithSpeciesData()`
- **Moves** -- `getMove()`, `listMoves()`, `getRawMove()`
- **Abilities/Items** -- `getAbility()`, `getItem()`, `listItems()`, `searchItems()`
- **Learnsets** -- `getLearnset()`
- **Type Chart** -- `getTypeChart()`, `getType()`
- **Mega/Z** -- `isMegaStone()`, `getMegaForm()`, `getMegaStonesFor()`, `isZCrystal()`, `getZCrystalType()`, `getSignatureZCrystal()`
- **Sprites** -- `getSpriteUrl()`, `getIconUrl()`
- **Dex** -- `getDex()`, `getGen9()`, `getRawSpecies()`

## Dependencies

- `@nasty-plot/core`
- `@pkmn/dex`, `@pkmn/data`, `@pkmn/img`

## Usage

```typescript
import { getSpecies, getLearnset, getSpriteUrl } from "@nasty-plot/pokemon-data"

const species = getSpecies("greatTusk") // { name: "Great Tusk", types: ["Ground","Fighting"], ... }
const learnset = await getLearnset("greatTusk")
const sprite = getSpriteUrl("greatTusk")
```
