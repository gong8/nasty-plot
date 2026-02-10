# Session: Dark Strategist Frontend Redesign
**Date:** 2026-02-10
**Duration context:** Long (multi-context, continued from a prior conversation that ran out of context)

## What was accomplished
- Implemented comprehensive "Dark Strategist" frontend redesign across ~35 files
- New Pecharunt-themed color palette (magenta primary hue 345, teal accent hue 170) using OKLch color format
- Added JetBrains Mono as display font (`font-display`) for headings
- Glassmorphism card surfaces in dark mode (`backdrop-blur-xl` + semi-transparent backgrounds)
- Subtle radial gradient on dark mode body background
- Pecharunt (#1025) mascot integration: header brand, chat panel avatar/empty state, home hero, 404/error pages, teams empty state
- Pecharunt favicon via Next.js metadata
- Restyled all shadcn components (card, dialog, sheet, tabs, skeleton, input, badge, progress, select, popover, button, textarea, switch, dropdown-menu)
- Flavor copy across all pages (subtitles, empty states, loading text) while keeping navigation labels and Pokemon terminology standard
- Light mode support restored with solid surfaces (no glassmorphism), dark mode retains glass effects
- Theme toggle restored after initial dark-only implementation

## Key decisions & rationale
- **Dark-first but light mode supported:** Initially planned dark-only, but user requested light mode. Solution: solid surfaces in light, glassmorphism in dark, using `dark:` prefix pattern (e.g. `bg-card dark:bg-glass-bg dark:backdrop-blur-xl`)
- **Pecharunt as mascot:** User loved Pecharunt (#1025, Poison/Ghost). Entire palette shifted from generic purple/cyan to Pecharunt's magenta chains (hue 345) and teal markings (hue 170)
- **`var()` indirection for custom properties:** All `@theme inline` entries use `var()` references to CSS variables defined in `:root`/`.dark`, ensuring Tailwind v4's CSS layer specificity doesn't override dark mode values
- **Copy rule:** Personality lives in subtitles, empty states, loading text only. Navigation labels and Pokemon terms stay standard and accessible
- **External favicon URL:** Used PokeAPI sprite URL directly in Next.js metadata rather than downloading/converting, for simplicity

## Bugs found & fixed
- **Header invisible in dark mode:** `dark:bg-glass-bg` was 60% opacity on a color nearly identical to background. Fixed with `dark:bg-card/80` and `dark:border-white/10`
- **Chat panel "ugly grey box":** Assistant message bubble was flat `bg-muted`. Fixed to `bg-muted/50 dark:bg-primary/5 border border-border`. Bot avatar changed to Pecharunt sprite with `bg-accent/15 text-accent`
- **Dark mode grey everywhere (chroma):** Neutral colors had too-low chroma (0.02-0.035), appearing desaturated grey. Increased to 0.04-0.06 and shifted hues to 325/335 for Pecharunt palette
- **ROOT CAUSE — bright backgrounds in dark mode:** `@theme inline` had hardcoded light values (`--color-glass-bg: oklch(1.0 0 0 / 80%)`) that override `.dark` block values due to Tailwind v4 CSS layer specificity. Fixed by converting to `var()` indirection pattern. This was the persistent issue across multiple user complaints

## Pitfalls & gotchas encountered
- **Tailwind v4 `@theme inline` specificity:** This is the biggest gotcha. Properties defined directly in `@theme inline` generate CSS on `:root` that has equal or higher specificity than `.dark` class selectors. Hardcoded values here will override dark mode. **Always use `var()` indirection** for any custom color property that needs to differ between light and dark modes
- **Incomplete var() fix:** After converting `@theme inline` to `var()` references, forgot to add the corresponding CSS variables to `:root` and `.dark` blocks AND the `.dark` block still had old `--color-*` prefixed names. Both sides of the indirection must match
- **Multiple rounds of dark mode fixes:** The user reported bright backgrounds 3 times. First two rounds fixed symptoms (chroma, specific hardcoded colors) but the root cause was the `@theme inline` specificity issue

## Files changed
**Foundation:**
- `apps/web/src/app/globals.css` — Complete palette rewrite, custom properties, var() indirection fix
- `apps/web/src/app/layout.tsx` — JetBrains Mono font, Pecharunt favicon metadata
- `apps/web/src/components/providers.tsx` — ThemeProvider config (defaultTheme="dark", enableSystem)
- `apps/web/src/components/site-header.tsx` — Glass header, Pecharunt brand sprite, restored ThemeToggle
- `apps/web/src/components/theme-toggle.tsx` — Deleted then restored

**shadcn Components:**
- `apps/web/src/components/ui/card.tsx` — Glass surface in dark mode
- `apps/web/src/components/ui/dialog.tsx` — Backdrop blur overlay, glass content
- `apps/web/src/components/ui/sheet.tsx` — Glass pattern matching dialog
- `apps/web/src/components/ui/tabs.tsx` — Primary-colored active state
- `apps/web/src/components/ui/skeleton.tsx` — `bg-muted` instead of `bg-accent`
- `apps/web/src/components/ui/input.tsx` — Transparent/glass background
- `apps/web/src/components/ui/button.tsx` — Dual-mode variants
- `apps/web/src/components/ui/select.tsx` — Glass content panel
- `apps/web/src/components/ui/popover.tsx` — Glass content panel
- `apps/web/src/components/ui/badge.tsx` — Dark mode adjustments
- `apps/web/src/components/ui/progress.tsx` — Dark mode adjustments
- `apps/web/src/components/ui/textarea.tsx` — Removed dark: redundancies
- `apps/web/src/components/ui/switch.tsx` — Removed dark: redundancies
- `apps/web/src/components/ui/dropdown-menu.tsx` — Removed dark: redundancies

**Shared UI:**
- `packages/ui/src/type-badge.tsx` — Glow box-shadow effect
- `packages/ui/src/pokemon-sprite.tsx` — `bg-muted` instead of `bg-gray-*`

**Pages:**
- `apps/web/src/app/page.tsx` — Pecharunt hero, font-display, flavor copy
- `apps/web/src/app/teams/page.tsx` — Font-display, flavor subtitle/empty state
- `apps/web/src/app/teams/new/page.tsx` — Flavor copy
- `apps/web/src/app/teams/[teamId]/page.tsx` — Flavor copy
- `apps/web/src/app/pokemon/page.tsx` — Font-display, subtitle
- `apps/web/src/app/damage-calc/page.tsx` — Font-display, subtitle
- `apps/web/src/app/battle/page.tsx` — Font-display, subtitle
- `apps/web/src/app/chat/page.tsx` — Title styling
- `apps/web/src/app/not-found.tsx` — Pecharunt, flavor copy
- `apps/web/src/app/error.tsx` — Pecharunt, flavor copy

**Feature Components:**
- `apps/web/src/features/battle/components/BattleField.tsx` — Dark arena gradient, status badge colors
- `apps/web/src/features/battle/components/BattleLog.tsx` — Dark: color variants
- `apps/web/src/features/battle/components/BattleView.tsx` — Win/lose text
- `apps/web/src/features/battle/components/FieldStatus.tsx` — Dark: color variants
- `apps/web/src/features/chat/components/chat-panel.tsx` — Pecharunt avatar/empty state, themed bubbles
- `apps/web/src/features/damage-calc/components/damage-calculator.tsx` — Dark-optimized KO colors
- `apps/web/src/features/damage-calc/components/matchup-matrix.tsx` — Dark: text variants
- `apps/web/src/features/analysis/components/coverage-chart.tsx` — Dual-mode coverage colors
- `apps/web/src/features/analysis/components/weakness-heatmap.tsx` — `bg-muted` for immune
- `apps/web/src/features/analysis/components/threat-list.tsx` — Dual-mode threat cards
- `apps/web/src/features/recommendations/components/recommendation-panel.tsx` — Dual-mode reason colors
- `apps/web/src/features/team-builder/components/team-grid.tsx` — Hover glow effect
- `apps/web/src/features/team-builder/components/guided-builder.tsx` — Flavor descriptions

## Known issues & next steps
- **Visual QA needed:** The full redesign should be visually inspected across all pages in both light and dark mode via `pnpm dev`
- **Glassmorphism performance:** `backdrop-blur-xl` can be expensive on mobile — should test on low-end devices
- **Favicon caching:** External URL favicon may have caching issues; consider downloading the Pecharunt sprite as a local `.ico` or `.png` in `app/` for reliability
- **Plan file cleanup:** The plan at `.claude/plans/sharded-knitting-dragon.md` can be deleted now that implementation is complete
- **Build verified:** `pnpm build` passes cleanly

## Tech notes
- **Tailwind v4 `@theme inline` pattern:** For any custom color token that needs light/dark variants, MUST use `var()` indirection: `@theme inline { --color-foo: var(--foo); }` with `--foo` defined separately in `:root` and `.dark`. Direct values in `@theme inline` will override `.dark` due to CSS specificity.
- **OKLch color format:** All colors use `oklch(lightness chroma hue)` or `oklch(lightness chroma hue / alpha%)`. Higher chroma = more saturated. Hue 345 = magenta (Pecharunt chains), 170 = teal (Pecharunt markings), 325 = plum (neutral surfaces).
- **Glass pattern for shadcn components:** `bg-card dark:bg-glass-bg dark:backdrop-blur-xl border dark:border-glass-border` — solid in light, frosted glass in dark.
- **Pecharunt sprite URL:** `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png` — used in header, chat, home, 404, error pages.
- **`next-themes` config:** `defaultTheme="dark"`, `enableSystem` enabled, `attribute="class"` (adds `.dark` class to `<html>`).
