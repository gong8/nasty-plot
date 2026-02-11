# Session: Type Color Contrast Fix

**Date:** 2026-02-11
**Duration context:** short

## What was accomplished

- Fixed poor text contrast on Pokemon type badges/labels across the entire app
- Extracted the luminance-based contrast check from `MoveSelector.tsx` (the one place it was done correctly) into a shared utility `isLightTypeColor()` in `@nasty-plot/core`
- Updated `TypeBadge` component to use adaptive text color (`text-gray-900` for light backgrounds, `text-white` for dark)
- Fixed all inline type badge usages in team builder, analysis, and battle components
- Converted two analysis components (weakness heatmap, coverage chart) from colored-text-on-background to background-badge approach for consistent contrast

## Key decisions & rationale

- **Shared utility in `@nasty-plot/core`** rather than duplicating the luminance function — it's a pure function tied to `TYPE_COLORS` which already lives in core
- **Named `isLightTypeColor`** (not `isLightColor`) to be specific to the domain and avoid ambiguity
- **Luminance threshold of 0.55** using weighted formula `(0.299*R + 0.587*G + 0.114*B) / 255` — carried over from the battle MoveSelector which the user confirmed had correct contrast
- **Weakness heatmap and coverage chart switched from text-color to background-badge** — using type colors as text color is inherently fragile (depends on page background), so matching the background-badge pattern used everywhere else is more robust

## Bugs found & fixed

- **Poor contrast on light Pokemon types:** Electric (`#F8D030`), Ice (`#98D8D8`), Ground (`#E0C068`), Steel (`#B8B8D0`), Normal (`#A8A878`), Bug (`#A8B820`), Rock (`#B8A038`), and Fairy (`#EE99AC`) all had white text on light backgrounds, making them hard to read
- Root cause: hardcoded `text-white` class on all type badges, with no luminance check
- Fix: adaptive text color based on background luminance

## Pitfalls & gotchas encountered

- The weakness heatmap and coverage chart used `TYPE_COLORS` as **text color** (not background), which is a different pattern from all other type styling. These needed a different fix approach — converting to background badges rather than just swapping text color.
- MoveSelector had TWO type badge patterns: the main move buttons (correctly adaptive) and the small target-selection type badges (hardcoded white). Both needed attention.

## Files changed

- `packages/core/src/constants.ts` — added `isLightTypeColor()` utility
- `packages/ui/src/type-badge.tsx` — adaptive text color in `TypeBadge` component
- `apps/web/src/features/battle/components/MoveSelector.tsx` — removed local `isLightColor`, uses shared utility, fixed target badges
- `apps/web/src/features/team-builder/components/team-grid.tsx` — adaptive badge text
- `apps/web/src/features/team-builder/components/pokemon-search-panel.tsx` — adaptive badge text
- `apps/web/src/features/team-builder/components/slot-editor.tsx` — adaptive badge text (3 locations) + tera type grid
- `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx` — adaptive tera type grid
- `apps/web/src/features/analysis/components/weakness-heatmap.tsx` — converted to background badges with adaptive text
- `apps/web/src/features/analysis/components/coverage-chart.tsx` — converted to background badges with adaptive text

## Known issues & next steps

- No remaining known contrast issues for type colors
- The coverage chart's background badge may look slightly different visually since it now has a colored background inside the `getCoverageLevel()` colored cells — worth a visual check to ensure it looks good

## Tech notes

- **Light types by luminance:** Electric (0.74), Ice (0.67), Ground (0.63), Steel (0.62), Normal (0.58), Bug (0.57), Rock (0.55) — all above the 0.55 threshold. Fairy (0.53) just below, stays white text.
- `isLightTypeColor` is exported from `@nasty-plot/core` barrel via `constants.ts` → `index.ts`
- The `TypeBadge` component from `@nasty-plot/ui` is the most-used type display component (used in ~10 files). Fixing it there cascaded the fix to most of the app automatically.
