# Plan: Full Showdown Dex Support with Format-Based Filtering

## Context

The app currently supports only ~839 Pokemon (Gen 9 SV-native), but Showdown supports ~1,225 selectable entries including "Past" Pokemon (Greninja, Mega evolutions, etc.) usable in National Dex formats. The `getAllSpecies()` function filters out `isNonstandard: "Past"` Pokemon, which is too restrictive for a Showdown companion tool. Additionally, the team editor doesn't pass `formatId` to Pokemon search, so users can add any Pokemon regardless of format legality.

## Changes

### 1. Add `isNonstandard` to `PokemonSpecies` type
**File:** `packages/core/src/types.ts` (line 28)

Add one field to `PokemonSpecies`:
```typescript
isNonstandard?: string | null;  // null = SV-native, "Past" = old-gen
```

### 2. Widen `getAllSpecies()` to include Past Pokemon
**File:** `packages/pokemon-data/src/dex.service.ts`

- In `toSpecies()` (line 22): add `isNonstandard: species.isNonstandard` to the returned object
- In `getAllSpecies()` (line 56): replace `!species.isNonstandard` with a targeted exclusion that only blocks CAP/LGPE/Custom/Future/Unobtainable, allowing `"Past"` through

```typescript
const EXCLUDED_NONSTANDARD = new Set(["CAP", "LGPE", "Custom", "Future", "Unobtainable"]);

// In the filter:
!EXCLUDED_NONSTANDARD.has(species.isNonstandard as string)
```

This changes `getAllSpecies()` from ~839 to ~1,225 entries.

### 3. Add dexScope filtering to `getFormatPokemon()`
**File:** `packages/formats/src/format.service.ts`

- In `getFormatPokemon()` (line 30): after ban check, filter out Past Pokemon for SV-scope formats
- In `isLegalInFormat()` (line 38): same dexScope check

```typescript
// In getFormatPokemon filter:
if (format.dexScope === "sv" && species.isNonstandard === "Past") return false;

// In isLegalInFormat:
if (format.dexScope === "sv" && species.isNonstandard === "Past") return false;
```

SV formats (gen9ou, gen9uu, etc.) continue to show only SV Pokemon. NatDex formats show everything.

### 4. Thread `formatId` through team editor Pokemon search
**Files:**
- `apps/web/src/features/team-builder/components/pokemon-search-panel.tsx` — accept optional `formatId` prop, append `&format=...` to the API call, include in queryKey
- `apps/web/src/features/team-builder/components/slot-editor.tsx` — accept optional `formatId` prop, pass to `PokemonSearchPanel`
- `apps/web/src/app/teams/[teamId]/page.tsx` (line 309) — pass `formatId={team.formatId}` to `<SlotEditor>`

### 5. Add NatDex formats to seed pipeline
**File:** `packages/data-pipeline/src/cli/seed.ts` (line 8)

Add to FORMATS array:
```typescript
{ id: "gen9nationaldex", name: "National Dex", generation: 9, gameType: "singles" as const },
{ id: "gen9nationaldexuu", name: "National Dex UU", generation: 9, gameType: "singles" as const },
```

### 6. Update tests
**Files:**
- `packages/pokemon-data/src/dex.service.test.ts` — update count assertions, add test that Past Pokemon (e.g. Greninja) is included, add test that `isNonstandard` field is populated
- `packages/formats/src/__tests__/format.service.test.ts` — add tests that SV formats exclude Past Pokemon and NatDex formats include them

## What NOT to change
- `getAllMoves()` / `getAllItems()` — Past moves/items are genuinely gone even in NatDex (Hidden Power, Pursuit, etc.)
- `getSpecies(id)` — already works for any Pokemon by ID (no isNonstandard filter)
- Pokemon browser page — already passes format to API, will work automatically
- `getLearnset()` — @pkmn/dex handles this correctly

## Verification
1. `pnpm test` — all tests pass
2. `pnpm dev` — visit `/pokemon` with no format: should show ~1,225 Pokemon
3. Visit `/pokemon` with OU format selected: should show only SV Pokemon
4. Visit `/pokemon` with National Dex selected: should show full roster
5. Open a gen9ou team, search for "Greninja" in slot editor: should NOT appear
6. Open a gen9nationaldex team, search for "Greninja": should appear
