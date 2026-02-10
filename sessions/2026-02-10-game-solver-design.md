# Session: Pokemon Game Solver Design
**Date:** 2026-02-10
**Duration context:** Long (extensive design discussion + research)

## What was accomplished
- Designed a comprehensive Pokemon battle simulator + AI solver feature from scratch
- Explored the full existing codebase to understand what foundation exists (types, damage calc, Smogon data, MCP server, etc.)
- Researched the entire Pokemon AI landscape: Foul Play (MCTS), Metamon (offline RL), Technical Machine (expectiminimax), PokéChamp (LLM minimax), poke-env, pkmn/engine
- Researched position evaluation functions from Percymon, Technical Machine, and competitive analysis — produced ranked evaluation weights
- Made all major design decisions through interactive Q&A with user
- Wrote comprehensive design document at `plans/pokemon-game-solver.md`
- Wrote initial implementation plan for first vertical slice at `.claude/plans/lively-seeking-bee.md`
- **Phases 1-3 were subsequently built** (by user or in a prior/parallel session) — the design doc was updated to reflect what has been implemented

## Key decisions & rationale
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Battle engine | `@pkmn/sim` | TypeScript, all gens, proven, same ecosystem as existing @pkmn packages |
| Formats | Singles + Doubles from start | @pkmn/sim handles both natively |
| Info modes | Full info + hidden info | Full for analysis/practice, hidden for competitive play |
| Build order | Full vertical slice (engine + UI + AI) | Deliver complete playable experience first |
| Sprites | `@pkmn/img` | Same ecosystem, easiest integration |
| Opponent teams | Scrape real competitive teams + LLM archetype picker | Random team gen is low quality; real teams + archetype selection is much better |
| Battle UI quality | Showdown-quality (functional, sprite-based) | Good balance of effort vs polish |
| Multiplayer | AI only to start | Avoids networking complexity |
| AI/Solver engine | Pure algorithmic (MCTS/heuristic) | Not LLM-dependent — consistent, fast, no API costs |
| LLM role | Optional commentary + strategy advisor, default OFF | Preserves API credits; solver is the brain, LLM is flavor |
| Eval function | Research-based (adapt Foul Play/Percymon weights) | Proven in practice; HP(1024), Pokemon alive(512), Stealth Rock(200), etc. |

## Bugs found & fixed
- N/A — this was a design/planning session, no code was written

## Pitfalls & gotchas encountered
- `pkmn/engine` (Zig, 1000x faster than @pkmn/sim) only supports Gen 1-2 currently — not viable for Gen 9
- Pokemon is imperfect information + stochastic — more like poker than chess. "Solving" requires probabilistic reasoning, not deterministic minimax
- Foul Play's author emphasizes set prediction is as important as search quality — our existing Smogon data is a major advantage here
- MCTS needs DUCT variant for Pokemon's simultaneous move selection
- Damage roll grouping (KO vs no-KO buckets) reduces branching from 32 to ~2-3 — critical optimization from Foul Play

## Files changed
- `plans/pokemon-game-solver.md` — Created, then updated by user to reflect Phases 1-3 completion status
- `.claude/plans/lively-seeking-bee.md` — Implementation plan for first vertical slice

## Known issues & next steps
### Phase 1-3 gaps (per updated design doc):
1. **Damage preview on move hover** — MoveSelector doesn't show expected damage ranges yet
2. **Doubles TeamPreview** — VGC 6→4→2 lead selection flow not implemented
3. **Doubles layout testing** — BattleField structurally supports 2v2 but untested in real doubles battle
4. **SetPredictor** — Use Smogon usage data to infer opponent sets in hidden-info mode
5. **Browser integration testing** — Full end-to-end manual testing needed

### Upcoming phases:
- **Phase 4**: Hint system + evaluation (eval bar, move recommendations, win probability)
- **Phase 5**: MCTS solver (DUCT variant, damage roll grouping, Web Workers)
- **Phase 6**: Sample teams + generation (scrape competitive teams, LLM archetype picker)
- **Phase 7**: Batch simulation + analytics (N games, win rates, matchup matrix)
- **Phase 8**: Post-battle + replay (save battles, replay viewer, "what if?" mode)
- **Phase 9**: LLM integration (commentary, strategic advisor)
- **Phase 10**: Polish (tournament mode, training mode, MCP tools, mobile UI)

## Tech notes
- **@pkmn/sim** uses `BattleStream` API — protocol-based communication, parse messages like `|move|`, `|-damage|`, `|switch|`, `|turn|`, `|win|`
- **battle-state.ts was merged into types/index.ts** — no separate file needed
- **battle-stream.ts was not needed** — `battle-manager.ts` uses `BattleStreams.BattleStream` directly
- **Route structure**: `/battle` (hub), `/battle/new` (setup), `/battle/live` (active battle via URL search params — simpler than `/battle/[id]` since no DB persistence yet)
- **Position eval weights** (from Percymon research): HP=1024, Pokemon alive=512, Fast Pokemon alive=512, Super-effective coverage=200, Stealth Rock=200, Substitute=150, Spikes=150, Status=100-120, STAB=100
- **AI difficulty tiers**: Random → Greedy (@smogon/calc damage) → Heuristic (type matchups + switching) → Expert (MCTS, future)
- **Existing AI tests**: team-packer (15 tests), protocol-parser (33 tests), ai (13 tests)
- **Key research projects to reference**: Foul Play (MCTS+DUCT, Python+Rust), Metamon (offline RL transformer), Percymon (weights.js for eval function)
