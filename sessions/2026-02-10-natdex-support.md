# Session: Full NatDex Support Implementation
**Date:** 2026-02-10
**Duration context:** Long — full plan review, clarification questions, 7-phase implementation with parallel agent team

## What was accomplished

- **Planned and fully implemented NatDex (National Dex) format support** across the entire stack — species, items, moves, Mega Evolution, Z-Crystals, validation, seed pipeline, and tests
- **Phase 1: Data Layer** — Added `isNonstandard` field to `PokemonSpecies`, `ItemData`, `MoveData` types. Widened `getAllSpecies()` (~839 to ~1225), `getAllItems()` (~249 to ~533), `getAllMoves()` (~685 to ~892) to include Past entries using `EXCLUDED_NONSTANDARD` set
- **Phase 2: Format Filtering** — Added dexScope-aware filtering to `getFormatPokemon()` and `isLegalInFormat()`. Created new `getFormatItems()`, `getFormatMoves()`, `getFormatLearnset()` functions in `packages/formats/src/format.service.ts`
- **Phase 3: API + UI Threading** — Added `?format=` parameter to items API and learnset API. Threaded `formatId` through `PokemonSearchPanel`, `SlotEditor`, `ItemCombobox`, and `MoveInput` components
- **Phase 4: Mega Evolution** — Created `isMegaStone()`, `getMegaStonesFor()`, `getMegaForm()` utilities. Added one-Mega-per-team and Mega Stone compatibility validation. Added Mega form preview API route and UI component
- **Phase 5: Z-Crystal Validation** — Created `isZCrystal()`, `getZCrystalType()`, `getSignatureZCrystal()` utilities. Added Z-Crystal move type pairing and signature Z-Crystal validation
- **Phase 6: Seed Pipeline Unification** — Replaced hardcoded `FORMATS` array in seed.ts with dynamic derivation from `FORMAT_DEFINITIONS`
- **Phase 7: Tests** — 195 tests across 3 packages (pokemon-data: 105, formats: 41, teams: 49), all passing
- **Infrastructure** — Added `vitest.config.ts` and `test` scripts to `pokemon-data` and `formats` packages (they were missing)

## Key decisions & rationale

- **Show everything (~1,225) when no format selected** — Matches Showdown's own dex behavior. Past Pokemon visible by default.
- **Prevent selection (not warn)** — Illegal options hidden from dropdowns for SV formats. Cleaner UX than warning badges.
- **Item-based Mega Evolution (Showdown style)** — User adds base Pokemon + Mega Stone item. Builder shows resulting form preview. This is how Showdown works.
- **Filter learnsets by format** — SV formats only show SV-legal moves, NatDex shows full learnset including past moves. Correct behavior.
- **Seed pipeline unified with FORMAT_DEFINITIONS** — Single source of truth for format data. Automatically picks up NatDex formats and future additions.
- **Validation in `packages/teams/` not `packages/core/`** — Mega/Z-Crystal validation needs `@nasty-plot/pokemon-data` imports, and `core` cannot depend on `pokemon-data` (would create circular dependency).
- **`EXCLUDED_NONSTANDARD` set pattern** — Exclude CAP/LGPE/Custom/Future/Unobtainable, allow everything else including "Past". Consistent across species, items, and moves.

## Bugs found & fixed

- **Original plan incorrectly stated "Past moves/items are genuinely gone even in NatDex"** — Research revealed 284 past items (Mega Stones, Z-Crystals) and 207 past moves (Hidden Power, Pursuit, Return) with `isNonstandard: "Past"` that ARE legal in NatDex. Plan was corrected.
- **Test assumed Greninja is a Past Pokemon** — `@pkmn/dex` Gen 9 returns `isNonstandard: null` for Greninja because it was added to SV via The Indigo Disk DLC. Fixed test to use Caterpie (confirmed Past).
- **`pokemon-data` and `formats` packages had no vitest config or test script** — Tests existed but couldn't run via `pnpm test`. Added `vitest.config.ts` with `globals: true` and `"test": "vitest run"` script to both.

## Pitfalls & gotchas encountered

- **Greninja is NOT Past in Gen 9** — It was added via DLC. Actual Past Pokemon: Caterpie, Weedle, Pidgey, Beedrill, etc. (~390 Past species total). Don't assume Gen 1-8 favorites are Past.
- **`@pkmn/dex` `megaStone` field** — On items, `megaStone` is an object mapping base species name to Mega form name (e.g., `{"Charizard": "Charizard-Mega-X"}`), not a simple string.
- **`@pkmn/dex` Z-Crystal fields** — `zMove` can be `true` (type-based) or a string (signature Z-Move name). `zMoveType` gives the type for type-based, `zMoveFrom` gives the source move for signature Z-Crystals, `itemUser` gives the species.
- **Turbo cache** — `pnpm test` with turborepo caches test results. After editing test files, the cached results may replay instead of running fresh. Run with `--filter` targeting specific packages to force fresh runs.
- **Pre-existing LLM test timeouts** — `@nasty-plot/llm` chat.service.test.ts has 10 timeout failures unrelated to our changes. Filter it out when running full suite.

## Files changed

### Core types
- `packages/core/src/types.ts` — Added `isNonstandard` to PokemonSpecies, ItemData, MoveData

### Data layer
- `packages/pokemon-data/src/dex.service.ts` — Widened filters, added `isNonstandard` to toSpecies/toMove/items, added Mega Stone utilities (isMegaStone, getMegaStonesFor, getMegaForm), Z-Crystal utilities (isZCrystal, getZCrystalType, getSignatureZCrystal)
- `packages/pokemon-data/src/index.ts` — Exported new functions
- `packages/pokemon-data/package.json` — Added test script
- `packages/pokemon-data/vitest.config.ts` — Created (globals: true)

### Format filtering
- `packages/formats/src/format.service.ts` — Added dexScope filtering, getFormatItems, getFormatMoves, getFormatLearnset
- `packages/formats/src/index.ts` — Exported new functions
- `packages/formats/package.json` — Added test script
- `packages/formats/vitest.config.ts` — Created (globals: true)

### Validation
- `packages/teams/src/validation.service.ts` — Rewrote to wrap core validation with Mega Stone and Z-Crystal checks

### API routes
- `apps/web/src/app/api/items/route.ts` — Added `?format=` support
- `apps/web/src/app/api/pokemon/[id]/learnset/route.ts` — Added `?format=` support
- `apps/web/src/app/api/pokemon/[id]/mega-form/route.ts` — New route for Mega form preview

### UI components
- `apps/web/src/features/team-builder/components/pokemon-search-panel.tsx` — Added formatId prop
- `apps/web/src/features/team-builder/components/slot-editor.tsx` — Added formatId prop threading, Mega form preview UI
- `apps/web/src/features/team-builder/components/item-combobox.tsx` — Added formatId prop
- `apps/web/src/app/teams/[teamId]/page.tsx` — Passes formatId to SlotEditor

### Seed pipeline
- `packages/data-pipeline/src/cli/seed.ts` — Replaced hardcoded FORMATS with FORMAT_DEFINITIONS import
- `packages/data-pipeline/package.json` — Added @nasty-plot/formats dependency

### Tests
- `packages/pokemon-data/src/dex.service.test.ts` — Added 39 new tests (NatDex species/items/moves, Mega utilities, Z-Crystal utilities)
- `packages/formats/src/__tests__/format.service.test.ts` — Added NatDex format mock, 13 new tests (dexScope filtering, item/move filtering, ban checking)
- `packages/teams/src/__tests__/validation.service.test.ts` — Added pokemon-data mocks, 9 new tests (Mega/Z-Crystal validation)

### Plan
- `plans/full-showdown-dex-support.md` — Completely rewritten with 7 phases, decisions section, expanded scope

## Known issues & next steps

- **Phase 4d Mega form preview UI** — mega-agent created this but it wasn't covered in Phase 7 tests. Should add API route tests and component tests.
- **No ability validation** — Team builder doesn't validate that a Pokemon's ability is legal for that species or format.
- **Tera type validation** — Stored but never validated against legal types.
- **Format-aware ability bans** — Some formats ban specific abilities (Arena Trap, Shadow Tag). The species ban check works via `format.bans`, but direct ability validation on team slots isn't implemented.
- **Run `pnpm seed`** — After deploying, run seed to populate NatDex format usage data (gen9nationaldex, gen9nationaldexuu).
- **LLM test timeouts** — 10 pre-existing failures in `@nasty-plot/llm` chat.service.test.ts need investigation (unrelated to NatDex).
- **Mega form preview UX** — Could be enhanced with sprite images, stat comparison vs base form, etc.

## Tech notes

- **`@pkmn/dex` isNonstandard values:** `null` = standard Gen 9, `"Past"` = old-gen/removed, `"CAP"` = fan-made, `"LGPE"` = Let's Go exclusives, `"Custom"` / `"Future"` / `"Unobtainable"` = various non-playable. We allow `null` and `"Past"` through, exclude everything else.
- **`DexScope` type** was already defined in core types and format definitions before this session. We just wired it into the actual filtering logic.
- **Mega Stone detection via `@pkmn/dex`:** `item.megaStone` is truthy for Mega Stones. It's an object mapping species name to Mega form name.
- **Z-Crystal detection via `@pkmn/dex`:** `item.zMove` is truthy for Z-Crystals. `true` = type-based, `string` = signature Z-Move name. `item.zMoveType` for type, `item.zMoveFrom` for source move, `item.itemUser` for species.
- **Parallel agent team pattern:** Used 4 agents (format-filtering, mega-agent, z-crystal-agent, seed-agent) plus a UI agent, coordinated via TeamCreate/SendMessage. Phases 2/4/5/6 ran in parallel after Phase 1 completed. Effective for multi-package work.
- **~390 Past species in Gen 9:** Includes Caterpie line, Weedle line, Pidgey line, Rattata line, all Gmax forms, regional forms of past-gen Pokemon, etc.
