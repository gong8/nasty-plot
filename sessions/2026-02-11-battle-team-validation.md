# Session: Battle Team Validation

**Date:** 2026-02-11
**Duration context:** Short

## What was accomplished

- Added pre-battle team validation to the battle setup flow (`/battle/new`)
- Start Battle button is now disabled (greyed out) when either team is invalid
- Each `TeamPicker` shows validation status: green checkmark with "N Pokemon ready" when valid, red alert with "Invalid team" when not
- Error details displayed below the Start Battle button explaining what's wrong (e.g. "Your team: garchomp: needs at least 1 move")

## Key decisions & rationale

- **Client-side paste parsing for validation:** Used the existing `parseShowdownPaste()` from `@nasty-plot/core` to validate team pastes in real-time as they're selected/pasted. This catches issues early without needing a server round-trip.
- **Validation scope kept minimal:** Only checks that (1) paste parses successfully, (2) at least 1 Pokemon exists, (3) each Pokemon has a `pokemonId`, and (4) each Pokemon has at least 1 move. Didn't add format legality checks — `@pkmn/sim` handles that at battle start and the UX cost of pre-checking would be high.
- **`useMemo` for validation:** Validation re-runs only when paste content changes, not on every render.
- **Error message format:** Errors are prefixed with "Your team:" or "Opponent:" and joined with `·` for a compact single-line display. Only shown when at least one team has content (avoids showing errors on initial empty state).

## Bugs found & fixed

- None — this was a new feature addition.

## Pitfalls & gotchas encountered

- The `TeamValidation` interface needed to be duplicated in `TeamPicker.tsx` since it's a prop type. Could be extracted to a shared types file but kept local to avoid over-engineering for a simple interface.

## Files changed

- `apps/web/src/features/battle/components/BattleSetup.tsx` — Added `validatePaste()` function, `useMemo` validation for both teams, `canStart` derived state, error display below button, passes `validation` prop to TeamPickers
- `apps/web/src/features/battle/components/TeamPicker.tsx` — Added `validation` optional prop, validation status indicator (checkmark/alert) next to label, imported `CheckCircle2` and `AlertCircle` icons

## Known issues & next steps

- **No format-specific legality validation:** Teams aren't checked against format rules (e.g. whether a Pokemon is banned in OU). This is handled reactively by `@pkmn/sim` when the battle starts.
- **No move legality check:** Doesn't verify that Pokemon can actually learn their listed moves.
- **Saved teams with incomplete slots:** If a saved team has Pokemon without moves in the DB, it will now show as invalid in battle setup. This is correct behavior but users might be surprised if they could start battles with such teams before.
- **Duplicate `TeamValidation` interface:** Defined in both `BattleSetup.tsx` and `TeamPicker.tsx`. Could be extracted to a shared location if more components need it.

## Tech notes

- `parseShowdownPaste()` returns `Partial<TeamSlotData>[]` — the `moves` field is a 4-tuple where empty slots are `undefined`, so filtering with `.filter(Boolean)` gives the actual move count.
- The pre-filled sample teams (SAMPLE_TEAM_1/SAMPLE_TEAM_2) pass validation immediately, so the default state still allows starting a battle right away.
- Previously the button was only disabled when `!playerSelection.paste.trim() || !opponentSelection.paste.trim()` — now it uses the richer `canStart` boolean derived from full paste parsing.
