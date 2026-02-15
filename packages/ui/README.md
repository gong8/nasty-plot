# @nasty-plot/ui

Shared React components for Pokemon display, selection, and stat editing. Built with Radix UI primitives and Tailwind CSS.

## Key Exports

- **Display** -- `PokemonSprite`, `TypeBadge`, `TypeGrid`, `StatBar`, `PokemonCard`, `CalculatedStatsDisplay`
- **Selectors** -- `SearchCombobox`, `PokemonSearchSelector`, `MoveSelector`, `AbilitySelector`, `GroupedSelector`
- **Editors** -- `EvEditor`, `IvEditor`
- **Utilities** -- `cn()` (className merge via `clsx` + `tailwind-merge`)

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/pokemon-data`
- `radix-ui`, `cmdk`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`
- Peer: `react ^19.0.0`

## Usage

```tsx
import { PokemonSprite, TypeBadge, cn } from "@nasty-plot/ui"

<PokemonSprite pokemonId="greatTusk" />
<TypeBadge type="ground" />
<div className={cn("p-4", isActive && "bg-blue-500")} />
```
