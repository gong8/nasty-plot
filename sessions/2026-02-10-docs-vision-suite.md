# Session: Product Vision & Docs Suite
**Date:** 2026-02-10
**Duration context:** Medium (~15 minutes wall-clock, heavily parallelized with 8 agents)

## What was accomplished
- Created the entire `docs/` folder with 8 comprehensive documents (~254KB total, ~4,740 lines)
- All documents written by parallel agents that verified file paths against the actual codebase
- Created Linear issue **NAS-21** for team versioning feature (High priority, Feature label, full scope breakdown)

### Documents created:
| File | Lines | Purpose |
|------|-------|---------|
| `docs/manifesto.md` | 275 | Heart & soul — 5 pillars of competitive Pokemon, principles, vision, naming |
| `docs/current-state.md` | 668 | Honest audit — 14 packages, 33 routes, 22 workflows, known gaps |
| `docs/concept-map.md` | 399 | Pillars-to-features mapping — 90 Exists, 3 Planned, 14 Future |
| `docs/roadmap.md` | 778 | 5 milestones (Foundation → Feedback Loop → Training → Assistant → Community) |
| `docs/feedback-loop.md` | 706 | Build/Test/Analyze/Tweak loop — rain team walkthrough, data flow diagrams |
| `docs/team-versioning.md` | 683 | Git-style teams — fork/compare/merge design doc with Prisma schema, types, services |
| `docs/personas.md` | 395 | 4 personas (Casey/Jordan/Alex/Sam), 4 experience layers, feature matrix |
| `docs/architecture-vision.md` | 836 | Package evolution, splitting triggers, performance roadmap, 7 invariants |

## Key decisions & rationale
- **Manifesto framing:** Reframed Aaron Traylor's "Competitive Pokemon may be Impossible to Explain" video thesis as the project's founding inspiration. The 5 pillars (Long-term Planning, Simultaneous Action, Imperfect Information, Probability Management, Team Building) serve as the conceptual backbone tying features to competitive concepts.
- **Lichess analogy:** Positioned Nasty Plot as "the Lichess of competitive Pokemon" — Showdown is the battlefield, Nasty Plot is the war room. This frames the product as complementary to Showdown, not competing with it.
- **Team versioning as full-copy, not diffs:** Teams are small (<5KB), so full copies are simpler, self-contained, and avoid diff-chain reconstruction complexity.
- **5-milestone roadmap:** M1 Foundation → M2 Feedback Loop → M3 Battle Training → M4 Intelligent Assistant → M5 Community & Scale. Each milestone has clear deliverables and success criteria.
- **Progressive disclosure over gatekeeping:** Experience layers (L0-L3) are self-selecting, not gated. Features are always accessible — complexity is layered, not locked.
- **Parallel agent execution:** Used 8 agents in a team to write all docs simultaneously (~5 minutes total vs ~40 minutes sequential). Each agent independently verified codebase file paths.

## Bugs found & fixed
- None (documentation-only session)

## Pitfalls & gotchas encountered
- Architecture-vision agent took longest (~3 minutes) because it read the most codebase files to verify package dependencies and structure
- All other agents finished within ~2 minutes

## Files changed
- `docs/manifesto.md` (new)
- `docs/current-state.md` (new)
- `docs/concept-map.md` (new)
- `docs/roadmap.md` (new)
- `docs/feedback-loop.md` (new)
- `docs/team-versioning.md` (new)
- `docs/personas.md` (new)
- `docs/architecture-vision.md` (new)

## Known issues & next steps
- **Review pass recommended:** Each doc was written by an independent agent. A consistency pass across all 8 docs would ensure terminology, status indicators, and cross-references are perfectly aligned.
- **NAS-21 (team versioning)** is now a Linear issue ready to be worked on — it's the signature M2 feature.
- **Roadmap milestones could become Linear projects** — consider creating Linear projects for M1-M5 and linking issues to them.
- **Concept-map statuses may drift** — as code is added, `docs/concept-map.md` status columns (Exists/Planned/Future) will need updating.
- **Manifesto could benefit from user review** — it's the most tone-dependent document and may need adjustment to match the creator's voice.

## Tech notes
- **Agent team pattern:** `TeamCreate` + 8 parallel `Task` agents with `run_in_background: true` + `SendMessage` shutdown requests is an effective pattern for parallelizing independent document creation. Total wall-clock time was ~5 minutes for 254KB of content.
- **Document sizes:** ~25-37KB each, 275-836 lines. The architecture doc was largest because it included the most code examples and tables.
- **Linear issue NAS-21:** Created with full markdown description including Prisma schema changes, TypeScript types, service API, route table, UI components, and 12-item subtask checklist. Git branch: `gonglx8/nas-21-implement-git-style-team-versioning-fork-compare-merge`.
