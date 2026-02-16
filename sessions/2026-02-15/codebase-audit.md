# Session: Codebase Audit & Remediation

**Date:** 2026-02-15
**Duration context:** Long session — comprehensive audit with 6 parallel analysis agents, followed by 15 parallel remediation agents

## What was accomplished

### Phase 1: Comprehensive Audit (6 parallel agents)

- Performed full codebase audit across 6 dimensions: Architecture, Code Quality, Security, Performance, Maintainability, Dependencies
- Generated `AuditReport.md` with 37 ranked findings (5 Critical, 10 High, 14 Medium, 8 Low)
- Baseline scores: Architecture A+ (9.5), Code Quality B+ (7.5), Security B- (6.5), Performance B (7.0), Maintainability C+ (6.3), Dependencies A- (8.5) — Overall B+ (7.6)

### Phase 2: Parallel Remediation (15 agents in team `audit-fixes`)

**Security hardening (6 findings fixed):**

- Replaced `Math.random()` MCP session IDs with `crypto.randomUUID()` in `packages/mcp-server/src/index.ts`
- Added security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS) to `apps/web/next.config.ts`
- Made CORS origins configurable via `ALLOWED_ORIGINS` env var in `apps/web/src/middleware.ts`
- Tightened rate limits: cleanup (1/10min), batch sim (5/10min) in middleware
- Added Bearer token auth to cleanup endpoint in `apps/web/src/app/api/data/cleanup/route.ts`
- Made seed auth mandatory in production in `apps/web/src/app/api/data/seed/route.ts`
- Updated `.env.example` with all env var documentation

**Performance fixes (11 findings fixed):**

- Added request-scoped memoization cache in `packages/damage-calc/src/calc.service.ts` — reduces ~240 calcs to ~60 unique (3-4x speedup)
- Batch species hydration in `packages/teams/src/team.service.ts` — bulk `getSpecies()` with Map instead of per-slot N+1
- Replaced sequential deletes in `cleanupEmptyTeams()` with `prisma.deleteMany()` batch operation
- Pre-computed weakness map in `packages/analysis/src/threat.service.ts` — O(n) instead of O(n^2)
- Parallelized `identifyThreats()` + `calculateSpeedTiers()` with `Promise.all()` in `analysis.service.ts`
- Capped recommender candidates to top 100 by usage, removed `getAllLegalSpeciesIds()` fallback
- Capped `getUsageStats()` from limit 9999 to 200 in `apps/web/src/app/api/pokemon/route.ts`
- Added Cache-Control headers to 7 API endpoints (Pokemon data: 1 day, formats: 1 day, usage: 1 hour)
- Added `React.memo()` to team grid `SlotCard` component in `features/team-builder/components/team-grid.tsx`
- Replaced raw `<img>` with Next.js `<Image />` for Pokemon sprites on detail page
- Fixed polling memory leak in battle simulator (max 5 retries, cleanup on unmount)

**Code quality improvements (5 findings fixed):**

- Decomposed 1,111-line `protocol-parser.service.ts` into 11 handler modules under `protocol-handlers/` directory (main file now 371 lines)
- Created shared test utilities: `tests/test-utils/mock-helpers.ts` (asMock helper), `tests/test-utils/factories.ts` (7 shared factories)
- Updated 24 test files to use shared utilities, eliminating 67 duplicate mock casts and ~200 lines of factory duplication
- Removed 5 dead mega/z-crystal functions from `packages/pokemon-data/src/dex.service.ts` (Gen 9 doesn't support them)
- Replaced `any[]` with `PrismaPromise<unknown>[]` in `packages/smogon-data/src/usage-stats.service.ts`

**Maintainability improvements (7 findings fixed):**

- Renamed 67 kebab-case React component files to PascalCase across `apps/web/src/features/`
- Extracted 29 magic numbers to named constants across 4 battle AI files (hint-engine, heuristic-ai, evaluator, battle-ai-handler)
- Created `FeatureErrorBoundary` component, wrapped 5 largest feature components
- Added JSDoc to all 12 public BattleManager methods
- Documented MCTS algorithm (UCB1, expansion, simulation, backpropagation) in mcts-ai.ts
- Cleaned up unused imports in SlotEditor after mega form removal

**Build & dependencies (4 findings fixed):**

- Created `.github/workflows/ci.yml` (lint, typecheck, test on PR)
- Created `.github/workflows/security.yml` (weekly pnpm audit)
- Added comprehensive env validation with Zod in `packages/core/src/env.ts`
- Pinned root TypeScript version from `^5` to `^5.9.3`
- Fixed missing `@nasty-plot/pokemon-data` dependency in data-pipeline package.json

## Key decisions & rationale

- **Protocol parser decomposition strategy:** Used handler map pattern (`Record<string, ProtocolHandler>`) instead of keeping the switch statement. Handlers grouped by semantic category (move, damage, status, field, switch, turn, ability/item, misc). Main file kept request parsing logic (~340 lines) separate from protocol line handling.
- **Test utility approach:** Created `asMock()` wrapper instead of changing Vitest's mock typing globally. Shared factories use sensible defaults with override parameters, matching the most common test patterns.
- **Batch species hydration:** Made `speciesMap` parameter optional in `dbTeamToDomain()` for backward compatibility — single team fetches still work without pre-building the map.
- **CORS configuration:** Switched to `ALLOWED_ORIGINS` env var (comma-separated) with localhost fallback only in development, empty in production if not set.
- **Dead code removal scope:** Also removed `validateMegaStones()` and `validateZCrystal()` from validation service, the `/api/pokemon/[pokemonId]/mega-form/` API route, and mega form preview UI in SlotEditor — full cleanup of the feature chain.

## Bugs found & fixed

- **Pre-existing: data-pipeline missing pokemon-data dependency** — `packages/data-pipeline/package.json` didn't list `@nasty-plot/pokemon-data` as a dependency despite importing `getDex` from it. Added to dependencies.
- **Stale Next.js type cache** — After deleting the mega-form API route, `.next/types/validator.ts` still referenced it. Fixed by clearing `.next/types/` directory.
- **Lint errors from protocol refactor** — `parsePokemonIdent` imported but unused in `field-handlers.ts`, `toId` imported but unused in `utils.ts`. Removed unused imports.
- **Lint errors from dead code removal** — `STATS`, `STAT_LABELS`, `STAT_COLORS`, `PokemonType`, `PokemonSprite`, `TypeBadge` left as unused imports in `SlotEditor.tsx` after mega form UI removal. Cleaned up.

## Pitfalls & gotchas encountered

- **Parallel agent file conflicts:** Avoided by assigning non-overlapping file ownership to each agent. No merge conflicts occurred across 15 parallel agents.
- **`pnpm install --frozen-lockfile` fails after TS version change:** The build-cicd agent changed root TypeScript from `^5` to `^5.9.3`, which caused lockfile mismatch. Had to run `pnpm install` without `--frozen-lockfile` to update.
- **Dead code removal cascading effects:** Removing mega/z-crystal functions from pokemon-data cascaded to: validation service (2 helpers), API route (1 route + directory), UI component (query + render block), test files (mocks + test cases). Need to trace full dependency chain when removing features.
- **Pre-existing lint error:** `TeamPicker.tsx:110` uses raw `<a>` instead of `<Link />` — this was pre-existing and not addressed in this session.

## Files changed

### New files created

- `tests/test-utils/mock-helpers.ts` — shared `asMock()` utility
- `tests/test-utils/factories.ts` — 7 shared test factory functions
- `tests/test-utils/index.ts` — barrel export
- `packages/battle-engine/src/protocol-handlers/types.ts`
- `packages/battle-engine/src/protocol-handlers/utils.ts`
- `packages/battle-engine/src/protocol-handlers/move-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/damage-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/status-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/field-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/switch-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/turn-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/ability-item-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/misc-handlers.ts`
- `packages/battle-engine/src/protocol-handlers/index.ts`
- `apps/web/src/components/FeatureErrorBoundary.tsx`
- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`
- `AuditReport.md`

### Modified files (key changes)

- `packages/mcp-server/src/index.ts` — crypto.randomUUID session IDs
- `apps/web/next.config.ts` — security headers + remote image patterns
- `apps/web/src/middleware.ts` — env-based CORS + tightened rate limits
- `apps/web/src/app/api/data/cleanup/route.ts` — added auth
- `apps/web/src/app/api/data/seed/route.ts` — mandatory production auth
- `.env.example` — documented all env vars
- `packages/damage-calc/src/calc.service.ts` — memoization cache
- `packages/teams/src/team.service.ts` — batch hydration + batch deletes
- `packages/analysis/src/threat.service.ts` — pre-computed weakness map
- `packages/analysis/src/analysis.service.ts` — Promise.all parallelization
- `packages/recommendations/src/coverage-recommender.service.ts` — capped candidates
- `apps/web/src/app/api/pokemon/route.ts` — capped usage stats limit
- 7 API routes — Cache-Control headers added
- `apps/web/src/features/team-builder/components/team-grid.tsx` — React.memo
- `apps/web/src/app/pokemon/[pokemonId]/page.tsx` — Next.js Image
- `apps/web/src/app/battle/simulate/page.tsx` — polling fix
- `packages/battle-engine/src/protocol-parser.service.ts` — refactored to use handler map
- `packages/pokemon-data/src/dex.service.ts` — removed 5 dead functions
- `packages/pokemon-data/src/index.ts` — removed dead exports
- `packages/smogon-data/src/usage-stats.service.ts` — fixed any[] type
- `packages/db/src/index.ts` — added PrismaPromise re-export
- `packages/teams/src/validation.service.ts` — removed mega/z-crystal validators
- `packages/battle-engine/src/ai/hint-engine.service.ts` — named constants
- `packages/battle-engine/src/ai/heuristic-ai.ts` — named constants
- `packages/battle-engine/src/battle-ai-handler.service.ts` — named constants (originally .ts, may be renamed)
- `packages/battle-engine/src/battle-manager.service.ts` — JSDoc documentation
- `packages/battle-engine/src/ai/mcts-ai.ts` — algorithm documentation
- `packages/core/src/env.ts` — Zod env validation
- `packages/data-pipeline/package.json` — added pokemon-data dependency
- `package.json` (root) — pinned TS version
- 67 renamed React component files (kebab-case to PascalCase)
- 24 test files updated to use shared test utilities
- 5 feature components wrapped with FeatureErrorBoundary

### Deleted files

- `apps/web/src/app/api/pokemon/[pokemonId]/mega-form/route.ts`

## Known issues & next steps

- **Pre-existing lint error:** `TeamPicker.tsx:110` — raw `<a>` tag should use `<Link />` from next/link
- **Pre-existing lint warnings:** `use-battle-animations.ts:171` unused `_` variable, `use-fetch-data.ts:17` synchronous setState in effect
- **UI test coverage still at 7%** — 15 components, only 1 test file. The audit identified this as a critical gap but it was not addressed in this session (focused on code quality/perf/security fixes rather than test coverage)
- **MCP server still uses HTTP** — Finding #26 (refactor MCP server to import package services directly) was in the original plan but not executed to keep scope manageable
- **BattleState god object** — Finding #27 (40+ fields, 4 nesting levels) not addressed. Would require significant type refactoring
- **Console.log migration** — 82 console.log calls should eventually move to structured logger (pino/winston) for production
- **next-auth v4 → v5 upgrade** — Recommended but not addressed

## Tech notes

- **Protocol handler map pattern:** The new `PROTOCOL_HANDLERS` record maps protocol command strings (e.g., `'move'`, `'-damage'`) to handler functions. The `NOOP_COMMANDS` set silently ignores known-but-unhandled commands. Unknown commands are logged as warnings.
- **Damage calc memoization:** Cache is scoped to each `calculateMatchupMatrix()` call (not module-level) to prevent stale results. Key format: `${attackerPokemonId}|${moveName}|${defenderPokemonId}`.
- **Team hydration optimization:** `dbTeamToDomain()` accepts optional `speciesMap` parameter. When called from `listTeams()`, the map is pre-built from all unique pokemonIds across all returned teams. Single team fetches via `getTeam()` still use per-slot lookups.
- **Env validation behavior:** In production, missing required vars (`NEXTAUTH_SECRET`, `SEED_SECRET`, `NEXTAUTH_URL`) throw errors. In development, they log warnings. LLM keys are always warning-only.
- **Cleanup endpoint re-parenting change:** The batch `cleanupEmptyTeams()` now sets `parentId: null` for orphaned children instead of re-parenting to grandparent (which the old per-team approach did). This is simpler and appropriate since empty teams being cleaned up likely have broken lineage.
