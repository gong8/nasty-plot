# Session: Team Picker Rework + Doubles Format Fixes

**Date:** 2026-02-11
**Duration context:** Medium

## What was accomplished

- Replaced paste-centric team selection in `/battle/new` with a visual team picker referencing saved/sample teams by ID
- Replaced hardcoded `FORMAT_OPTIONS` array (which had stale VGC 2024 entry) with a dynamic `FormatSelector` that loads from actual format definitions, grouped by Singles/Doubles
- Propagated team IDs through the full battle flow (`BattleSetup` -> URL params -> `useBattle` hook -> `saveBattle` POST body) so saved battles link to the `Team` table
- Added format selector + team picker to the batch simulator page (`/battle/simulate`), replacing its hardcoded `gen9ou`/`singles`
- Fixed the `res.json()` bug on the `/api/teams/{id}/export` endpoint (returns `text/plain`, not JSON)

## Key decisions & rationale

- **`TeamSelection` type with `source` discriminator**: Uses `"saved" | "sample" | "paste"` to track where a team came from. Only `"saved"` teams get their `teamId` propagated to the battle save, since sample team IDs are from the `SampleTeam` table (not the `Team` table referenced by `Battle.team1Id`/`team2Id` FKs).
- **Client-side gameType filtering for saved teams**: Rather than filtering by exact `formatId`, teams are filtered by compatible `gameType` (singles vs doubles). A gen9ou team works in gen9uu. Uses `format.gameType` when hydrated, falls back to format ID pattern matching (`includes("doubles")` / `includes("vgc")`).
- **gameType change clears saved team selections**: When switching from a singles format to doubles (or vice versa), saved team selections are cleared to avoid using incompatible teams. Switching within the same gameType (OU to UU) keeps selections.
- **Collapsible paste section**: Paste textarea is hidden behind a toggle ("Or paste a team manually") to reduce visual noise, but remains available as a fallback.
- **No API changes**: The existing `POST /api/battles` route already accepts `team1Id`/`team2Id`, and `GET /api/formats` already returns all format definitions. No backend work was needed.

## Bugs found & fixed

- **`BattleSetup.tsx:243` — `res.json()` on text/plain endpoint**: The old code called `res.json()` on `/api/teams/{id}/export` which returns `text/plain`. This silently failed (the `.data?.paste` check returned undefined). Fixed by using `res.text()` in the new `TeamPicker`.
- **Stale VGC 2024 in `FORMAT_OPTIONS`**: Hardcoded array included `gen9vgc2024regh` but the actual active format is `gen9vgc2025`. Replaced with dynamic loading from `@nasty-plot/formats` definitions.
- **Batch simulator hardcoded to gen9ou/singles**: The simulate page always sent `formatId: "gen9ou"` and `gameType: "singles"` regardless of what format the user intended. Now uses dynamic format selection.

## Pitfalls & gotchas encountered

- **`GameType` export verification**: Had to verify that `GameType` was actually exported from `@nasty-plot/core`'s barrel (`src/index.ts` re-exports `* from "./types"` which includes `GameType`).
- **`/api/teams` response shape**: The `useTeams()` hook's `fetchJson` returns the array directly (the API uses `NextResponse.json(teams)` without a `{ data: ... }` wrapper), while `/api/formats` wraps in `{ data: [...] }`. Had to check both to get the parsing right.
- **Pre-existing test failures**: 3 tests in `tests/llm/chat.service.test.ts` fail on the dirty working tree (pre-existing changes to `packages/llm/`). Verified by stashing all changes and running tests — all 1587 pass on clean state. These failures are unrelated to this session's work.

## Files changed

**New files (5):**

- `apps/web/src/features/battle/hooks/use-formats.ts` — React Query hook for format data
- `apps/web/src/features/battle/hooks/use-sample-teams.ts` — React Query hook for sample teams
- `apps/web/src/features/battle/components/FormatSelector.tsx` — Grouped format dropdown (Singles/Doubles)
- `apps/web/src/features/battle/components/TeamPickerCard.tsx` — Compact team card with sprites
- `apps/web/src/features/battle/components/TeamPicker.tsx` — Full team picker with tabs + paste fallback

**Modified files (5):**

- `apps/web/src/features/battle/components/BattleSetup.tsx` — Replaced internals with new components
- `apps/web/src/app/battle/new/page.tsx` — Passes `t1id`/`t2id` URL params
- `apps/web/src/features/battle/hooks/use-battle.ts` — Added team IDs to config + saveBattle body
- `apps/web/src/app/battle/live/page.tsx` — Reads `t1id`/`t2id` from URL params
- `apps/web/src/app/battle/simulate/page.tsx` — Added FormatSelector + TeamPicker

## Known issues & next steps

- **3 pre-existing test failures** in `tests/llm/chat.service.test.ts` from dirty `packages/llm/` changes — need to be addressed separately
- **Team picker grid is 1-column**: Plan mentioned 2-column grid for `TeamPickerCard`, current implementation uses 1-column (`grid-cols-1`) for compactness within the card. Could be expanded if cards feel too stacked.
- **No auto-populate of team name in batch simulator**: Plan mentioned auto-populating team name input when a card is clicked. Currently team name inputs are independent of team selection. Could wire up `onSelectionChange` to also update the name field.
- **Visual testing needed**: The format selector, team picker tabs, sprite rendering, and collapsible paste section should be visually verified in the browser with `pnpm dev`.

## Tech notes

- **`@pkmn/img` sprite pattern**: `Sprites.getPokemon(id, { gen: "gen5ani", side: "p2" })` — `p2` = front-facing sprites (opponent perspective), `p1` = back-facing (player perspective). Used throughout battle components.
- **`/api/teams/{id}/export` returns `text/plain`**: Must use `res.text()`, not `res.json()`. This is the Showdown paste format as a raw string.
- **`/api/sample-teams` returns bare array**: Unlike `/api/formats` which wraps in `{ data: [...] }`, sample teams come as a plain JSON array.
- **Format definitions include VGC 2025**: `packages/formats/src/data/format-definitions.ts` has both `gen9vgc2024` (id line 218) and `gen9vgc2025` (id line 251, with `smogonStatsId: "gen9vgc2025regj"` at line 276). The `isActive` flag controls which appear in the UI.
- **`TeamData.format` hydration is optional**: Teams may or may not have the `format` field populated. The `TeamPicker` falls back to format ID string matching for gameType inference when `format` is not hydrated.
