# Session: Fix sample team import crash

**Date:** 2026-02-11
**Duration context:** Short

## What was accomplished

- Fixed crash when importing sample teams in the guided team builder
- Improved sample team import to use full paste parsing instead of empty placeholder slots

## Key decisions & rationale

- **Parse the paste instead of using pokemonIds:** The previous code built empty slots from `pokemonIds` (no moves, EVs, abilities). Since the `SampleTeamEntry` already carries the full Showdown paste, we now use `parseShowdownPaste()` to extract complete sets. This means imported sample teams immediately have proper moves, EVs, IVs, abilities, items, and natures.

## Bugs found & fixed

- **`sampleTeam.pokemonIds.slice(...).map is not a function`** — The `SampleTeamEntry` interface declared `pokemonIds: string[]`, but Prisma returns it as a raw comma-separated string from the `SampleTeam.pokemonIds` column (`String` type in schema). Calling `.slice().map()` on a string works for `.slice()` (returns a substring) but the substring's `.map()` doesn't exist. Fixed by splitting the string to an array in `fetchSampleTeams`.

## Pitfalls & gotchas encountered

- `SampleTeam.pokemonIds` is stored as a comma-separated `String` in Prisma/SQLite (schema comment says "comma-separated for LIKE queries"), but the frontend TypeScript interface expected `string[]`. This type mismatch wasn't caught because `fetchSampleTeams` returned raw `res.json()` without any transformation.

## Files changed

- `apps/web/src/features/team-builder/hooks/use-guided-builder.ts` — Added `parseShowdownPaste` import, fixed `fetchSampleTeams` to convert pokemonIds string to array, rewrote `importSampleTeam` to parse paste

## Known issues & next steps

- The `pokemonIds` type mismatch (DB string vs TS array) could bite other consumers of the sample-teams API. Consider normalizing in the API route itself rather than per-client.
- The guided builder's sample team import now jumps to the "sets" step — verify that the parsed slots integrate correctly with the rest of the guided flow (e.g. `applyAllSets`, set editing UI).

## Tech notes

- `SampleTeam.pokemonIds` in Prisma schema is `String` (comma-separated), not a JSON array. This is intentional for SQL LIKE queries but requires `.split(",")` on the client side.
- `parseShowdownPaste()` from `@nasty-plot/core` returns `Partial<TeamSlotData>[]` — positions are not set by the parser, so they need to be assigned after parsing.
