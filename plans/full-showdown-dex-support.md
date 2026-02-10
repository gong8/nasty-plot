# Plan: Full Showdown Dex Support with Format-Based Filtering

## Context

The app currently supports only ~839 Pokemon (Gen 9 SV-native), but Showdown supports ~1,225 selectable entries including "Past" Pokemon (Greninja, Mega evolutions, etc.) usable in National Dex formats. The same problem exists for items (~249 SV-native vs ~533 including Mega Stones and Z-Crystals) and moves (~685 vs ~892 including past moves like Hidden Power and Pursuit).

**Current problems:**
- `getAllSpecies()` filters out `isNonstandard: "Past"` Pokemon — too restrictive
- `getAllItems()` filters out Past items (Mega Stones, Z-Crystals) — NatDex teams can't use them
- `getAllMoves()` filters out Past moves (Hidden Power, Pursuit, Return) — NatDex teams can't use them
- Team editor doesn't pass `formatId` to Pokemon/item/move selection — no format-aware filtering
- No validation for item/move/ability legality — users can add illegal combos to any team
- No Mega Evolution or Z-Move mechanics support in team builder

**What already exists:**
- `DexScope` type (`"sv" | "natdex"`) defined in `packages/core/src/types.ts`
- Format definitions already have `dexScope` populated in `packages/formats/src/data/format-definitions.ts`
- `/api/pokemon` already supports `?format=` parameter via `getFormatPokemon()`
- Battle engine already supports Mega Evolution commands (`action.mega`)
- `getSpecies(id)` already works for any Pokemon by ID (no isNonstandard filter)
- Pokemon browser page already passes format to API

## Decisions

- **Default unfiltered view:** Show everything (~1,225 species). Past Pokemon visible when no format selected.
- **Illegal selection handling:** Prevent selection — don't show illegal options in dropdowns. SV formats hide past species/items/moves.
- **Mega Evolution UX:** Item-based (Showdown style) — user adds base Pokemon + Mega Stone item. Builder shows resulting form info.
- **Learnset filtering:** Filter by format — SV formats only show SV-legal moves, NatDex shows full learnset including past moves.
- **Seed pipeline:** Unify with FORMAT_DEFINITIONS as single source of truth.

---

## Phase 1: Data Layer — Widen Species, Items, Moves

Widen all three `getAll*()` functions to include Past entries. Add `isNonstandard` field to domain types.

### 1a. Add `isNonstandard` to domain types

**File:** `packages/core/src/types.ts`

```typescript
// Add to PokemonSpecies:
isNonstandard?: string | null;  // null = SV-native, "Past" = old-gen

// Add to ItemData:
isNonstandard?: string | null;

// Add to MoveData:
isNonstandard?: string | null;
```

### 1b. Widen `getAllSpecies()` to include Past Pokemon

**File:** `packages/pokemon-data/src/dex.service.ts`

- In `toSpecies()`: add `isNonstandard: species.isNonstandard ?? null`
- In `getAllSpecies()`: replace `!species.isNonstandard` with targeted exclusion

```typescript
const EXCLUDED_NONSTANDARD = new Set(["CAP", "LGPE", "Custom", "Future", "Unobtainable"]);

// In getAllSpecies filter, replace:
//   !species.isNonstandard
// with:
//   (!species.isNonstandard || !EXCLUDED_NONSTANDARD.has(species.isNonstandard))
```

Result: ~839 → ~1,225 species.

### 1c. Widen `getAllItems()` to include Past items

**File:** `packages/pokemon-data/src/dex.service.ts`

Same pattern — add `isNonstandard` to returned object, use `EXCLUDED_NONSTANDARD` filter.

Result: ~249 → ~533 items (includes Mega Stones and Z-Crystals).

### 1d. Widen `getAllMoves()` to include Past moves

**File:** `packages/pokemon-data/src/dex.service.ts`

Same pattern — add `isNonstandard` to `toMove()`, use `EXCLUDED_NONSTANDARD` filter.

Result: ~685 → ~892 moves (includes Hidden Power, Pursuit, Return, etc.).

---

## Phase 2: Format Filtering — dexScope-Aware Services

Make format service filter species, items, and moves based on `format.dexScope`.

### 2a. Species filtering (existing function, add dexScope check)

**File:** `packages/formats/src/format.service.ts`

In `getFormatPokemon()` and `isLegalInFormat()`:
```typescript
if (format.dexScope === "sv" && species.isNonstandard === "Past") return false;
```

### 2b. Add `getFormatItems(formatId)` function

**File:** `packages/formats/src/format.service.ts`

New function — returns items legal in a given format.
```typescript
export function getFormatItems(formatId: string): ItemData[] {
  const format = getFormat(formatId);
  if (!format) return [];
  return getAllItems().filter(item => {
    if (format.dexScope === "sv" && item.isNonstandard === "Past") return false;
    // Check item bans (e.g., specific Mega Stones banned in a format)
    return !isBannedItem(item, format);
  });
}
```

Also add item ban checking against `format.bans` (some formats ban specific items).

### 2c. Add `getFormatMoves(formatId)` function

**File:** `packages/formats/src/format.service.ts`

New function — returns moves legal in a given format.
```typescript
export function getFormatMoves(formatId: string): MoveData[] {
  const format = getFormat(formatId);
  if (!format) return [];
  return getAllMoves().filter(move => {
    if (format.dexScope === "sv" && move.isNonstandard === "Past") return false;
    // Check move bans (e.g., "Baton Pass" banned in NatDex)
    return !isBannedMove(move, format);
  });
}
```

### 2d. Add `getFormatLearnset(speciesId, formatId)` function

**File:** `packages/formats/src/format.service.ts` (or `packages/pokemon-data/src/dex.service.ts`)

Wraps `getLearnset()` with format filtering — cross-references against `getFormatMoves()`.
```typescript
export async function getFormatLearnset(speciesId: string, formatId: string): Promise<MoveData[]> {
  const learnset = await getLearnset(speciesId);
  const legalMoves = new Set(getFormatMoves(formatId).map(m => m.id));
  return learnset.filter(moveId => legalMoves.has(moveId));
}
```

### 2e. Update barrel exports

**File:** `packages/formats/src/index.ts`

Export new functions: `getFormatItems`, `getFormatMoves`, `getFormatLearnset`.

---

## Phase 3: API + UI Threading

Thread `formatId` through all team editor selection UIs. Add format support to items API.

### 3a. Items API — add format parameter

**File:** `apps/web/src/app/api/items/route.ts`

Add `?format=` support (same pattern as `/api/pokemon`):
```typescript
const formatId = searchParams.get("format");
let items = formatId ? getFormatItems(formatId) : getAllItems();
```

### 3b. Learnset API — add format parameter

**File:** `apps/web/src/app/api/pokemon/[id]/learnset/route.ts`

Add `?format=` support:
```typescript
const formatId = searchParams.get("format");
const moves = formatId
  ? await getFormatLearnset(id, formatId)
  : await getLearnset(id);
```

### 3c. Thread formatId through team editor — Pokemon search

**Files:**
- `apps/web/src/features/team-builder/components/pokemon-search-panel.tsx` — accept `formatId?` prop, append `&format=` to API call
- `apps/web/src/features/team-builder/components/slot-editor.tsx` — accept `formatId?` prop, pass to `PokemonSearchPanel`
- `apps/web/src/app/teams/[teamId]/page.tsx` — pass `formatId={team.formatId}` to `<SlotEditor>`

### 3d. Thread formatId through team editor — Item combobox

**File:** `apps/web/src/features/team-builder/components/item-combobox.tsx`

Accept `formatId?` prop, append `&format=` to `/api/items` call.

**File:** `apps/web/src/features/team-builder/components/slot-editor.tsx`

Pass `formatId` to `<ItemCombobox>`.

### 3e. Thread formatId through team editor — Move selector

**File:** `apps/web/src/features/team-builder/components/slot-editor.tsx` (MoveInput component)

Pass `?format=` to the learnset API call so only format-legal moves appear.

---

## Phase 4: Mega Evolution Mechanics

Item-based Mega Evolution support (Showdown style).

### 4a. Mega Stone → Pokemon mapping utility

**File:** `packages/pokemon-data/src/dex.service.ts` (new functions)

```typescript
// Get the Mega form a Pokemon transforms into when holding a specific Mega Stone
export function getMegaForm(pokemonId: string, itemId: string): PokemonSpecies | null

// Get all valid Mega Stones for a given Pokemon
export function getMegaStonesFor(pokemonId: string): ItemData[]

// Check if an item is a Mega Stone
export function isMegaStone(itemId: string): boolean
```

Use `@pkmn/dex` — Mega Stones have a `megaStone` field pointing to the species name, and species have `megaEvolves` / `megaStone` fields.

### 4b. One Mega per team validation

**File:** `packages/teams/src/validation.service.ts` (or `packages/core/src/validation.ts`)

New validation rule in `validateTeam()`:
```typescript
// Count slots holding Mega Stones
const megaCount = slots.filter(s => isMegaStone(s.item)).length;
if (megaCount > 1) {
  errors.push({ type: "team", message: "Only one Mega Evolution per team" });
}
```

### 4c. Mega Stone ↔ Pokemon compatibility validation

**File:** `packages/teams/src/validation.service.ts`

Validate that if a Pokemon holds a Mega Stone, it's actually the correct stone for that Pokemon:
```typescript
if (isMegaStone(slot.item) && !getMegaStonesFor(slot.pokemonId).some(s => s.id === slot.item)) {
  errors.push({ type: "slot", position: slot.position, message: `${slot.item} is not compatible with this Pokemon` });
}
```

### 4d. Mega form preview in team builder UI

**File:** `apps/web/src/features/team-builder/components/slot-editor.tsx`

When user selects a Mega Stone as item, show a preview of the resulting Mega form (types, stats, ability). Non-blocking — purely informational.

---

## Phase 5: Z-Crystal Validation

Z-Crystal ↔ move type pairing support.

### 5a. Z-Crystal utility functions

**File:** `packages/pokemon-data/src/dex.service.ts` (new functions)

```typescript
// Check if an item is a Z-Crystal
export function isZCrystal(itemId: string): boolean

// Get the type a Z-Crystal powers up (e.g., "Electrium Z" → "Electric")
export function getZCrystalType(itemId: string): PokemonType | null

// Get signature Z-Crystal info (e.g., "Pikanium Z" requires Pikachu + Volt Tackle)
export function getSignatureZCrystal(itemId: string): { pokemonId: string; moveId: string } | null
```

Use `@pkmn/dex` — Z-Crystals have `zMove` and `zMoveFrom` fields.

### 5b. Z-Crystal ↔ move validation

**File:** `packages/teams/src/validation.service.ts`

Validate that if a Pokemon holds a Z-Crystal:
- For type-based Z-Crystals: Pokemon knows at least one move of the matching type
- For signature Z-Crystals: Pokemon is the correct species AND knows the signature move

```typescript
if (isZCrystal(slot.item)) {
  const sig = getSignatureZCrystal(slot.item);
  if (sig) {
    // Signature Z-Crystal — validate Pokemon + move
    if (slot.pokemonId !== sig.pokemonId || !slot.moves.includes(sig.moveId)) {
      errors.push({ ... });
    }
  } else {
    // Type-based Z-Crystal — validate at least one matching-type move
    const zType = getZCrystalType(slot.item);
    const hasMatchingMove = slot.moves.some(m => getMove(m)?.type === zType);
    if (!hasMatchingMove) {
      errors.push({ ... });
    }
  }
}
```

### 5c. Z-Crystal info in item selection UI

When a Z-Crystal is selected, show which moves it powers up. Informational, same pattern as Mega preview.

---

## Phase 6: Seed Pipeline Unification

Replace hardcoded FORMATS array with FORMAT_DEFINITIONS as single source of truth.

### 6a. Unify seed formats with format definitions

**File:** `packages/data-pipeline/src/cli/seed.ts`

Replace the hardcoded `FORMATS` array:
```typescript
// Before:
const FORMATS = [
  { id: "gen9ou", name: "OU", generation: 9, gameType: "singles" as const },
  // ... 10 entries
];

// After:
import { FORMAT_DEFINITIONS } from "@nasty-plot/formats";
const FORMATS = FORMAT_DEFINITIONS.filter(f => f.isActive).map(f => ({
  id: f.id,
  name: f.name,
  generation: f.generation,
  gameType: f.gameType,
}));
```

This automatically picks up NatDex formats (gen9nationaldex, gen9nationaldexuu) and any future additions.

---

## Phase 7: Tests

### 7a. Data layer tests

**File:** `packages/pokemon-data/src/dex.service.test.ts`

- Update species count assertions (~839 → ~1,225)
- Test that Past Pokemon (Greninja, Mega Charizard X) are included with `isNonstandard: "Past"`
- Test that CAP Pokemon are still excluded
- Test that Past items (Mega Stones, Z-Crystals) are included
- Test that Past moves (Hidden Power, Pursuit) are included
- Test `getMegaStonesFor()`, `isMegaStone()`, `isZCrystal()`, `getZCrystalType()`

### 7b. Format filtering tests

**File:** `packages/formats/src/__tests__/format.service.test.ts`

- SV formats (gen9ou) exclude Past Pokemon/items/moves
- NatDex formats include Past Pokemon/items/moves
- `getFormatItems()` respects item bans
- `getFormatMoves()` respects move bans (e.g., "Baton Pass" in NatDex)
- `getFormatLearnset()` cross-references format-legal moves with actual learnset

### 7c. Validation tests

**File:** `packages/teams/src/__tests__/validation.service.test.ts`

- One Mega per team rule
- Mega Stone ↔ Pokemon compatibility
- Z-Crystal ↔ move type pairing
- Signature Z-Crystal validation (correct Pokemon + move)

### 7d. API tests (optional, lower priority)

- `/api/items?format=gen9ou` excludes Mega Stones
- `/api/items?format=gen9nationaldex` includes Mega Stones
- `/api/pokemon/[id]/learnset?format=gen9ou` excludes past moves

---

## Execution Order & Dependencies

```
Phase 1 (Data Layer)
  ↓
Phase 2 (Format Filtering)  →  Phase 6 (Seed Unification)
  ↓
Phase 3 (API + UI Threading)
  ↓
Phase 4 (Mega Evolution)  ‖  Phase 5 (Z-Crystals)   ← parallel
  ↓
Phase 7 (Tests)  ← can start per-phase, final pass at end
```

Phases 4 and 5 are independent and can be done in parallel.
Phase 6 is independent of 3-5 and can be done anytime after Phase 1.
Tests should be written incrementally with each phase, with a final pass in Phase 7.

---

## What NOT to change

- `getSpecies(id)` — already works for any Pokemon by ID (no isNonstandard filter)
- Pokemon browser page — already passes format to API, works automatically after Phase 2
- `getLearnset()` raw function — keep as-is, add `getFormatLearnset()` wrapper
- Battle engine — already supports Mega commands, no changes needed
- Showdown paste parser — already handles Mega Stones and Z-Crystals as plain items
- Database schema — items/moves stored as strings, no schema change needed

## Verification

1. `pnpm test` — all tests pass
2. `pnpm dev` → `/pokemon` with no format: should show ~1,225 Pokemon
3. `/pokemon` with OU: should show only SV Pokemon
4. `/pokemon` with National Dex: should show full roster including Greninja
5. Team editor (gen9ou): search "Greninja" → NOT shown; items exclude Mega Stones; moves exclude Hidden Power
6. Team editor (gen9nationaldex): search "Greninja" → shown; Mega Stones available; Hidden Power available in learnsets
7. Add Charizard + Charizardite X to NatDex team → Mega form preview shown
8. Add second Mega Stone to same team → validation error
9. Add Electrium Z to Pokemon with no Electric moves → validation warning
10. Seed pipeline picks up NatDex formats automatically
