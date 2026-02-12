# Session: Fix batch simulation determinism

**Date:** 2026-02-12
**Duration context:** Short

## What was accomplished

- Diagnosed why batch simulations always produced 50-0 or 0-50 results (every game was identical)
- Fixed batch simulator to generate unique PRNG seeds per game, producing realistic win distributions

## Key decisions & rationale

- **Seed generation uses `Math.random()`** — Simple and sufficient. Each game gets 4 random 16-bit numbers as a PRNG seed, matching `@pkmn/sim`'s `PRNGSeed` format (`[number, number, number, number]`). No need for `crypto.getRandomValues` since this is game simulation, not security.
- **Seed passed via `>start` command JSON** — The `@pkmn/sim` BattleStream accepts a `seed` field in the start spec. This was the cleanest integration point rather than trying to modify the BattleStream constructor.
- **Only batch simulator was changed to auto-seed** — The `BattleManager` (live battles) and standalone `runAutomatedBattle` keep their default behavior. The seed is an opt-in config field on `AutomatedBattleConfig` so callers can provide one when needed.

## Bugs found & fixed

- **Batch sim always 50-0 or 0-50:** Root cause was `new BattleStreams.BattleStream()` being created without a PRNG seed in `automated-battle-manager.ts`. Without a seed, `@pkmn/sim` uses the same default PRNG state for every battle, making damage rolls, accuracy checks, and crit chances identical. Combined with deterministic AI decisions (GreedyAI/HeuristicAI always pick the highest-scoring move), every game played out identically.

## Pitfalls & gotchas encountered

- The `@pkmn/sim` seed protocol message (`|seed|`) was already being parsed in `protocol-parser.ts` but explicitly ignored (returned `null`). This made it non-obvious that seeding was even a feature.

## Files changed

- `packages/battle-engine/src/simulation/automated-battle-manager.ts` — Added `seed` field to `AutomatedBattleConfig`, exported the interface, pass seed in `>start` JSON
- `packages/battle-engine/src/simulation/batch-simulator.ts` — Generate random 4-element PRNG seed per game before calling `runAutomatedBattle`

## Known issues & next steps

- The `BattleManager` (live/interactive battles) does not seed the PRNG either — this is fine for single battles but could be worth adding for replay reproducibility (save the seed alongside the protocol log)
- Pre-existing test failures in `tests/llm/` (3 files, 7 tests) — unrelated to this change

## Tech notes

- `@pkmn/sim` PRNG seed format: `[number, number, number, number]` — four unsigned 16-bit integers
- Seed is passed in the `>start` command: `>start {"formatid":"gen9ou","seed":[1234,5678,9012,3456]}`
- Without a seed, the sim uses a deterministic default, which is why all battles in a batch were identical
- The AI players (GreedyAI, HeuristicAI) are deterministic given the same game state — randomness must come from the simulator's damage rolls, not the AI
