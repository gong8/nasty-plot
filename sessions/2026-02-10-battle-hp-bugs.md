# Session: Battle HP Display Bugs

**Date:** 2026-02-10
**Duration context:** Short

## What was accomplished

- Identified and fixed two critical HP display bugs in the battle system
- Root-caused the issues to the protocol parser's handling of dual-perspective BattleStream output from `@pkmn/sim`
- All 1294 existing tests continue to pass after fixes

## Key decisions & rationale

- **"Only increase maxHp" guard in protocol handlers**: Rather than trying to detect percentage vs absolute HP format (which would be fragile), the fix uses a simple invariant: protocol lines can only _increase_ `maxHp`, never decrease it. This works because:
  - The first perspective sets maxHp (possibly to 100 from percentage format)
  - The second perspective or `|request|` data corrects it upward to the real value
  - Percentage format always produces maxHp=100, which is always <= the real absolute maxHp (except Shedinja, which is 1/1 either way)
- **`updateSideFromRequest` as authoritative source**: The `|request|` JSON always has absolute HP values, so it's the source of truth. It unconditionally sets maxHp except when condition is `"0 fnt"` (where it preserves the existing value).

## Bugs found & fixed

### Bug 1: maxHP suddenly drops from real value to 100

**Symptoms:** Pokemon HP bar shows e.g. `/100` instead of `/319`. HP appears to "jump" to a different denominator mid-battle.

**Root cause:** `@pkmn/sim`'s BattleStream outputs TWO chunks per turn — one per player's perspective. Your own Pokemon show absolute HP (`219/319`), but the opponent's Pokemon show percentage HP (`69/100`). The deduplication check (`lastProtocolChunk`) fails because the HP values differ between perspectives, so both chunks get processed. The second perspective's percentage denominator (100) overwrites the correct absolute maxHp (319).

**Fix:** Changed the switch handler and damage/heal handler to only allow maxHp to increase: `if (hpData.maxHp > pokemon.maxHp)` instead of unconditionally setting it. Also changed `parseHp`'s fallback from `maxHp || 100` to `maxHp || 0` to prevent a silent default of 100.

### Bug 2: Fainted Pokemon show 0/0 instead of 0/maxHP

**Symptoms:** When a Pokemon reaches 0 HP, the health bar displays `0/0` instead of `0/319`.

**Root cause:** `updateSideFromRequest` unconditionally set `pokemon.maxHp = hpData.maxHp`. For fainted Pokemon, the request's condition field is `"0 fnt"`, and `parseHp("0 fnt")` returns `{hp: 0, maxHp: 0}`, erasing the known maxHp.

**Fix:** Added guard `if (hpData.maxHp > 0)` in `updateSideFromRequest` so faint condition preserves the existing maxHp. Also fixed `stats.hp` assignment to fall back to `pokemon.maxHp` when `hpData.maxHp` is 0.

## Pitfalls & gotchas encountered

- **Dual-perspective BattleStream output**: The `@pkmn/sim` BattleStream produces separate chunks for each player. Each chunk contains protocol lines from that player's perspective (with their own Pokemon in absolute HP and the opponent in percentage HP). The existing deduplication logic only compares raw string equality, which fails when the same event has different HP formats across perspectives. This is a fundamental characteristic of the sim that the codebase must account for.
- **Object identity between active and team arrays**: `side.active[idx] = pokemon` means the active slot is the SAME object reference as the team entry. Any mutation from one code path affects all views of that Pokemon.

## Files changed

- `packages/battle-engine/src/protocol-parser.ts` — 4 changes:
  - `parseHp()`: Removed dangerous `maxHp || 100` fallback
  - Switch handler: Added `maxHp > pokemon.maxHp` guard
  - Damage/heal handler: Added `maxHp > pokemon.maxHp` guard
  - `updateSideFromRequest()`: Added `maxHp > 0` guard + fixed `stats.hp` fallback

## Known issues & next steps

- **No tests for percentage-format HP**: The test suite doesn't cover the scenario where protocol lines contain percentage HP (`69/100`) that could corrupt absolute maxHp. Should add tests simulating dual-perspective processing.
- **No test for faint preserving maxHp**: The existing faint test checks `hp === 0` and `fainted === true` but doesn't assert that `maxHp` is preserved. Should add `expect(pokemon.maxHp).toBe(319)`.
- **Protocol deduplication is fragile**: The `lastProtocolChunk` string comparison doesn't properly deduplicate protocol events that differ only in HP format. A more robust approach would be to process only one perspective's protocol lines or merge them intelligently.
- **hpPercent calculation with percentage HP**: When the protocol sends `69/100` (percentage), `pokemon.hp` is set to 69 (the percentage value, not the real HP). The `hpPercent` is then recalculated from `hp/maxHp` which, if maxHp is the real 319, gives `Math.round(69/319*100) = 22%` — incorrect. This is masked because `updateSideFromRequest` overwrites with correct absolute values shortly after, but there may be brief visual flickers.

## Tech notes

- **`@pkmn/sim` HP format by perspective**: Your own Pokemon = absolute (`219/319`), opponent's Pokemon = percentage (`69/100`). The `|request|` JSON always has absolute values for your own side's Pokemon.
- **BattleStream chunk flow**: `processOutput` processes chunks line-by-line. Protocol lines accumulate until a `|request|` line is hit, at which point protocol is processed via `processChunk`, then the request is handled via `handleRequest` → `updateSideFromRequest`. Each player's chunk triggers this flow separately.
- **Object identity matters**: `side.active[idx]` and `side.team[n]` can be the same object. Mutations in protocol-parser affect both the active display and the switch menu/team list.
