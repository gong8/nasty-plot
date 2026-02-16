# Comprehensive Codebase Audit Report

**Project:** Nasty Plot - Pokemon Team Builder and Competitive Analysis Platform
**Audit Date:** 2026-02-15
**Auditor:** Senior Staff Software Engineer and Security Auditor (Automated)
**Scope:** Full-stack analysis - Architecture, Code Quality, Security, Performance, Maintainability

---

## Executive Summary

**Overall Grade: A- (Excellent)**

Nasty Plot is a **professionally architected** monorepo with strict TypeScript, clean layered dependencies, zero circular imports, and an 86% test-to-source line ratio. The codebase demonstrates engineering discipline well above average for a project of this scale. The primary risks are **security gaps in authentication** (dev-only auth that would be dangerous in production) and **6 oversized behavioral files** that concentrate too many responsibilities. No critical code quality or architectural issues were found.

| Dimension               | Grade | Summary                                                   |
| ----------------------- | ----- | --------------------------------------------------------- |
| Architecture            | A+    | Perfect layering, zero circular deps, 100% barrel exports |
| Code Quality            | A     | 1 `any` type, 0 TODOs, minimal duplication                |
| Security                | B-    | 1 Critical (dev auth), 2 High, 4 Medium findings          |
| Performance             | B+    | Good caching patterns, some missing memoization           |
| Maintainability         | B+    | Strong foundations, 6 files need decomposition            |
| Dependencies and Config | A     | 95/100 consistency, all deps current                      |

---

## Quantitative Codebase Profile

| Metric                                 | Value                 |
| -------------------------------------- | --------------------- |
| Total source files (packages/ + apps/) | 390                   |
| Total lines of source code             | 42,492                |
| Total test files                       | 94                    |
| Total lines of test code               | 36,572                |
| Test-to-source ratio (by lines)        | 0.86 (86%)            |
| Packages                               | 14                    |
| API route files                        | 46                    |
| React components (.tsx)                | 148                   |
| Export statements                      | 1,055                 |
| Average file size                      | 108 lines (median 67) |
| Largest file                           | 1,219 lines           |
| Deepest directory nesting              | 10 levels             |

---

## 1. Architecture

**Grade: A+**

### Strengths

- **Perfect dependency layering.** 5 clear layers (Foundation, Data, Domain, Feature, Presentation) with **zero critical violations** across 100+ cross-package imports. Only 1 justified exception: `data-pipeline` imports from `teams` for seeding.
- **Zero circular dependencies.** Verified across all 14 packages.
- **100% barrel export coverage.** Every package exports through `src/index.ts`. Smart subpath exports (`formats/db`, `llm/browser`) isolate server-only code from client bundles.
- **Strict barrel import pattern.** No reaching into internal package paths. All inter-package imports use `@nasty-plot/<pkg>` barrels.
- **Thin API controllers.** All 46 API routes delegate business logic to packages. Average route length: 41 lines. Routes handle only HTTP concerns (validation, response formatting).
- **Controlled class usage.** Only 9 classes in the entire codebase (5 AI players, 1 BattleManager, 1 ReplayEngine, 1 TTLCache, 1 StreamParser). All justified.

### Package Distribution

| Layer        | Packages                                                     | Files | Lines  |
| ------------ | ------------------------------------------------------------ | ----- | ------ |
| Foundation   | core, db                                                     | 14    | 1,540  |
| Data         | pokemon-data, formats, smogon-data, data-pipeline            | 24    | 4,484  |
| Domain       | teams, analysis, damage-calc, recommendations, battle-engine | 59    | 9,210  |
| Feature      | llm, mcp-server                                              | 33    | 2,609  |
| Presentation | ui, web                                                      | 260+  | 24,649 |

### Findings

| ID  | Finding                                         | Severity | Details                                                   |
| --- | ----------------------------------------------- | -------- | --------------------------------------------------------- |
| A1  | data-pipeline imports from Domain layer (teams) | Low      | Justified for seeding; isolated to `seed-sample-teams.ts` |

---

## 2. Code Quality and Technical Debt

**Grade: A**

### Type Safety Metrics

| Metric                    | Count              | Assessment                                                              |
| ------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `any` types               | 1 (test mock only) | Excellent                                                               |
| Type assertions (`as`)    | 63 total           | ~40 are `as const` (safe); 6 `as unknown` (justified @pkmn workarounds) |
| Non-null assertions (`!`) | 0 detected         | Excellent                                                               |
| TODO/FIXME/HACK comments  | 0                  | Excellent                                                               |
| Commented-out code        | ~4 lines           | Negligible                                                              |
| Dead/unused exports       | 0 detected         | Excellent                                                               |

### DRY Compliance

- **Excellent centralization** of conversion logic: `statsToDbColumns()`, `dbColumnsToStats()`, `movesToDb()` in core/teams
- **No significant duplication** across packages. Domain-specific `toX()` converters have different inputs/outputs (not true duplication)
- **Minor opportunity:** `handleP1Request()` / `handleP2Request()` in battle-request-handler share ~80% logic, but extraction would reduce clarity for asymmetric game state

### Naming Consistency

- Consistent `camelCase` functions, `PascalCase` types, `{name}.service.ts` pattern
- Consistent `p1`/`p2` naming in battle engine
- Consistent type suffixes: `Data`, `Input`, `View`, `Row`
- **Minor:** Slot positioning uses mixed 0-indexed (`targetSlot`) and 1-indexed (`moveIndex`) - documented but easy to confuse

### Findings

| ID  | Finding                                                | Severity | Details                                   |
| --- | ------------------------------------------------------ | -------- | ----------------------------------------- |
| Q1  | 6 `as unknown` type assertions for @pkmn/sim internals | Low      | Fragile but necessary for library interop |
| Q2  | Battle request handler duplication (~80% shared logic) | Low      | Would reduce clarity if extracted         |
| Q3  | Mixed 0/1-indexed slot numbering                       | Low      | Documented in types; consider type alias  |

---

## 3. Security Risks

**Grade: B-**

### Critical (1)

| ID  | Finding                              | File                             | Details                                                                                                                                                                                                            |
| --- | ------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | **Dev auth accepts ANY credentials** | `apps/web/src/lib/auth.ts:12-16` | `authorize()` callback returns success for any non-empty username/password. Auth is disabled entirely when `NODE_ENV !== "production"`. If deployed to production with wrong config, entire system is unprotected. |

### High (2)

| ID  | Finding                                              | File                           | Details                                                                                                                                                        |
| --- | ---------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S2  | **Hardcoded NEXTAUTH_SECRET in committed .env**      | `.env:17`                      | Secret `"nasty-plot-dev-secret-change-in-production"` is trivially guessable. `.env` is tracked in git. Token forgery possible if production uses same secret. |
| S3  | **Seed endpoint unprotected when SEED_SECRET unset** | `api/data/seed/route.ts:78-86` | Auth only required if `SEED_SECRET` is set OR `NODE_ENV=production`. In dev, `SEED_SECRET=` (empty), so anyone can trigger expensive data sync. DoS vector.    |

### Medium (4)

| ID  | Finding                                           | File                                  | Details                                                                                                                        |
| --- | ------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| S4  | API key fallback to `"not-needed"` literal        | `llm/src/openai-client.service.ts:12` | OpenAI client initializes with literal string if env vars missing. Confusing errors instead of clear auth failure.             |
| S5  | Unvalidated MCP_URL from environment              | `llm/src/config.ts:3`                 | If attacker controls env, Claude CLI connects to attacker-controlled MCP server. Could inject malicious tool responses.        |
| S6  | Prompt injection via user-controlled chat context | `llm/src/chat.service.ts:150-156`     | `contextData` embedded into system prompt without sanitization. Mitigated by strict tool allowlisting.                         |
| S7  | CORS origin validation not strict                 | `apps/web/src/middleware.ts:5-21`     | No protocol validation on `ALLOWED_ORIGINS`. Falls back to first origin on mismatch. Empty value in `.env` could cause issues. |

### Low (3)

| ID  | Finding                                         | File                             | Details                                                                       |
| --- | ----------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| S8  | Silent validation failure in seed endpoint      | `api/data/seed/route.ts:90-98`   | Failed Zod parse silently defaults instead of returning 400                   |
| S9  | Auth endpoints use default rate limit (100/min) | `middleware.ts:23-29`            | Should be stricter for auth; brute-force slower but still possible            |
| S10 | TOCTOU in temp file handling                    | `llm/src/cli-chat.service.ts:13` | Symlink attack on `/tmp/nasty-plot-cli` possible in multi-tenant environments |

### Safe Areas

- **SQL Injection:** All queries use Prisma parameterized API. Zero raw query usage.
- **XSS:** Zero unsafe HTML injection patterns found. No `innerHTML` assignments, no unsafe rendering. React auto-escaping protects all output.
- **Dependencies:** All packages at current versions (Next.js 16.1.6, Prisma 7.3.0, React 19.2.4).

---

## 4. Performance and Scalability

**Grade: B+**

### Strengths

- **TTL cache for usage stats** (5-min TTL) prevents repeated DB queries
- **Batch upserts** with transaction chunking (500 ops/chunk) for data sync
- **Parallel query execution** (`Promise.all` for count + fetch in pagination)
- **MCTS config is bounded** (10K iterations, 5s timeout, 4 determinizations)
- **Database indexes** on all high-traffic query paths (UsageStats, SmogonSet, TeammateCorr, Battle)

### Findings

| ID  | Finding                                                       | Severity | File                                                                          | Details                                                                                        |
| --- | ------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P1  | Pokemon search filters all in memory                          | Medium   | `api/pokemon/route.ts:19-48`                                                  | Loads 1000+ species, filters/sorts in memory, then paginates. Scales poorly.                   |
| P2  | Damage calc results only cached per-request                   | Medium   | `damage-calc/calc.service.ts:159-191`                                         | Matchup matrix recalculates all damage on every request. No persistent LRU cache.              |
| P3  | Over-fetching slot columns in listTeams                       | Medium   | `teams/team.service.ts:196-205`                                               | `include: { slots }` fetches all EV/IV/move columns even for list view.                        |
| P4  | Loop-based getSpecies calls (3 services)                      | Low      | `threat.service.ts`, `analysis.service.ts`, `coverage-recommender.service.ts` | Sequential dex lookups in loops (50-100 calls). @pkmn/dex is in-memory so impact is minor.     |
| P5  | battle-engine exports may bundle @pkmn/sim (~500KB) to client | Medium   | `battle-engine/package.json`                                                  | Main export re-exports MCTS, protocol parser, etc. Client imports could pull server-only code. |
| P6  | UI imports full @pkmn/dex                                     | Medium   | `ui/package.json`                                                             | Components referencing species would bundle entire dex. Needs lightweight browser entry.       |
| P7  | Missing composite index on BattleTurn                         | Low      | `prisma/schema.prisma`                                                        | No `(battleId, turnNumber)` composite for replay ordered queries                               |

---

## 5. Maintainability

**Grade: B+**

### Top 10 Most Problematic Files

| Rank | File                                                      | Lines | Severity | Issue                                                     |
| ---- | --------------------------------------------------------- | ----- | -------- | --------------------------------------------------------- |
| 1    | `data-pipeline/src/data/sample-teams.ts`                  | 1,219 | High     | Hardcoded team data; should be JSON/DB                    |
| 2    | `battle-engine/src/battle-manager.service.ts`             | 711   | High     | 30+ methods; stream + protocol + AI + prediction concerns |
| 3    | `features/damage-calc/components/DamageCalculator.tsx`    | 615   | High     | Monolithic component; UI + calc + API logic mixed         |
| 4    | `features/team-builder/context/GuidedBuilderProvider.tsx` | 576   | High     | Context provider + complex business orchestration         |
| 5    | `features/chat/hooks/use-chat-stream.ts`                  | 504   | Medium   | Streaming + parsing + token collection combined           |
| 6    | `app/teams/[teamId]/page.tsx`                             | 493   | Medium   | Page with embedded form + edit logic                      |
| 7    | `battle-engine/src/ai/hint-engine.service.ts`             | 464   | Medium   | Multiple hint strategies in single file                   |
| 8    | `battle-engine/src/ai/mcts-ai.ts`                         | 460   | Medium   | Complex MCTS algorithm; sparse comments                   |
| 9    | `smogon-data/src/usage-stats.service.ts`                  | 438   | Low      | Multi-function service; acceptable for data layer         |
| 10   | `battle-engine/src/ai/heuristic-ai.ts`                    | 396   | Low      | Heuristic complexity is inherent to domain                |

### Error Handling

- **37/46 API routes** (80%) use consistent `apiErrorResponse()` pattern
- **9 routes** lack try-catch in GET handlers (rely on validation only)
- **0 empty catch blocks** found
- **Only 1 error boundary** in entire web app (`FeatureErrorBoundary` on DamageCalculator)

### Documentation

| Metric                              | Value                                    |
| ----------------------------------- | ---------------------------------------- |
| JSDoc coverage (exported functions) | ~85%                                     |
| JSDoc coverage (React components)   | ~40%                                     |
| JSDoc coverage (hooks)              | ~35%                                     |
| README files per package            | 14/14 (100%)                             |
| Inline comment density (avg)        | 3-5% (target: 8-10% for complex modules) |

### Test Coverage by Package

| Package         | Test Files | Test Lines | Assessment    |
| --------------- | ---------- | ---------- | ------------- |
| battle-engine   | 21         | 16,265     | Comprehensive |
| llm             | 12         | 3,976      | Good          |
| smogon-data     | 4          | 2,790      | Good          |
| teams           | 6          | 2,674      | Good          |
| core            | 6          | 2,381      | Good          |
| mcp-server      | 9          | 1,882      | Good          |
| api             | 7          | 1,166      | Adequate      |
| recommendations | 3          | 1,099      | Limited       |
| analysis        | 4          | 896        | Limited       |
| ui              | 11         | 730        | Adequate      |
| formats         | 3          | 716        | Limited       |
| pokemon-data    | 1          | 713        | Minimal       |
| damage-calc     | 1          | 666        | Minimal       |
| data-pipeline   | 2          | 386        | Minimal       |
| **db**          | **0**      | **0**      | **None**      |

### Findings

| ID  | Finding                                                | Severity | Details                                                                         |
| --- | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------- |
| M1  | BattleManager handles 8+ concerns (711 lines)          | High     | Extract protocol handling, AI delegation, set prediction into separate services |
| M2  | DamageCalculator monolithic component (615 lines)      | High     | Split into attacker/defender config + calc hook + results display               |
| M3  | GuidedBuilderProvider mixes context with orchestration | High     | Move orchestration to custom hook; keep provider lean                           |
| M4  | `@nasty-plot/db` has zero tests                        | Medium   | Prisma client singleton is untested                                             |
| M5  | Only 1 error boundary in entire web app                | Medium   | Battle, teams, chat pages lack error protection                                 |
| M6  | 9 API GET routes lack try-catch                        | Medium   | Service errors would surface as 500s without context                            |
| M7  | 1,219-line sample-teams.ts data file                   | Low      | Extract to JSON or seed from DB                                                 |

---

## 6. Dependencies and Configuration

**Grade: A**

### Dependency Health

- **4 minor updates available:** Prisma 7.3 to 7.4, jsdom 28.0 to 28.1, turbo 2.8.3 to 2.8.9
- **Zero duplicate dependencies** at conflicting versions
- **Zero unused dependencies** detected
- **All version ranges safe** (caret ranges, no wildcard or overly broad specifiers)

### Configuration Consistency

| Aspect                           | Status                            |
| -------------------------------- | --------------------------------- |
| TypeScript strict mode           | 15/15 packages                    |
| ESM modules (`"type": "module"`) | 14/14 packages (apps/web missing) |
| Package naming (`@nasty-plot/*`) | 14/14                             |
| Barrel exports field             | 14/14                             |
| ESLint (flat config)             | Consistent across all packages    |
| Prettier                         | Consistent settings (.prettierrc) |
| Project references (tsconfig)    | All 14 packages listed correctly  |

### Findings

| ID  | Finding                                               | Severity | Details                                                                    |
| --- | ----------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| C1  | `apps/web` missing `"type": "module"`                 | Medium   | Has null instead of `"module"`. Next.js 16 expects ESM.                    |
| C2  | No env var validation at startup                      | Medium   | Missing Zod schema check for required vars (DATABASE_URL, NEXTAUTH_SECRET) |
| C3  | 3 packages have redundant `"main"` + `"types"` fields | Low      | Duplicate the `"exports"` field; harmless but unnecessary                  |
| C4  | Inconsistent tsconfig include pattern in llm package  | Low      | Uses `["src"]` instead of `["src/**/*.ts"]`                                |

---

## Consolidated Findings - Ranked by Impact

### Critical (1)

| ID  | Category | Finding                                                      | Impact                                                 |
| --- | -------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| S1  | Security | Dev auth accepts any credentials; disabled in non-production | Full system compromise if deployed with wrong NODE_ENV |

### High (6)

| ID  | Category        | Finding                                                | Impact                           |
| --- | --------------- | ------------------------------------------------------ | -------------------------------- |
| S2  | Security        | Hardcoded NEXTAUTH_SECRET in committed .env            | Token forgery in production      |
| S3  | Security        | Seed endpoint unprotected when SEED_SECRET unset       | DoS via expensive data sync      |
| M1  | Maintainability | BattleManager handles 8+ concerns (711 lines)          | Hard to test, modify, or extend  |
| M2  | Maintainability | DamageCalculator monolithic component (615 lines)      | Mixed UI/logic; poor reusability |
| M3  | Maintainability | GuidedBuilderProvider mixes context with orchestration | Violates single responsibility   |
| P5  | Performance     | battle-engine may bundle @pkmn/sim to client (~500KB)  | Client bundle bloat              |

### Medium (10)

| ID  | Category        | Finding                                        | Impact                               |
| --- | --------------- | ---------------------------------------------- | ------------------------------------ |
| S4  | Security        | API key fallback to literal string             | Confusing error behavior             |
| S5  | Security        | Unvalidated MCP_URL from environment           | SSRF if env is compromised           |
| S6  | Security        | Prompt injection via chat context              | Limited by tool allowlisting         |
| S7  | Security        | CORS origin validation not strict              | Cross-site requests if misconfigured |
| P1  | Performance     | Pokemon search filters 1000+ species in memory | Scales poorly with dataset growth    |
| P2  | Performance     | Damage calc results not cached across requests | Redundant expensive computations     |
| P3  | Performance     | Over-fetching slot columns in team list        | Unnecessary data transfer            |
| M4  | Maintainability | @nasty-plot/db has zero tests                  | Untested critical path               |
| M5  | Maintainability | Only 1 error boundary in web app               | Unhandled errors crash UI            |
| C1  | Config          | apps/web missing "type": "module"              | Potential module resolution issues   |

### Low (10)

| ID  | Category     | Finding                                     | Impact                          |
| --- | ------------ | ------------------------------------------- | ------------------------------- |
| S8  | Security     | Silent validation failure in seed endpoint  | Masks input errors              |
| S9  | Security     | Auth endpoints use default rate limit       | Brute-force possible at 100/min |
| S10 | Security     | TOCTOU in temp file handling                | Symlink attack in multi-tenant  |
| P4  | Performance  | Loop-based getSpecies calls (3 services)    | Minor; dex is in-memory         |
| P6  | Performance  | UI imports full @pkmn/dex                   | Browser bundle ~800KB           |
| P7  | Performance  | Missing composite index on BattleTurn       | Slower replay queries           |
| Q1  | Code Quality | 6 `as unknown` assertions for @pkmn interop | Fragile but necessary           |
| Q2  | Code Quality | Battle request handler duplication          | Clarity trade-off               |
| C3  | Config       | Redundant main/types fields in 3 packages   | Harmless noise                  |
| C4  | Config       | Inconsistent tsconfig include in llm        | Functional but inconsistent     |

---

## Actionable Recommendations - Ordered by Impact

### Tier 1: Security Hardening (Do First)

1. **Implement real authentication** - Replace the accept-all `authorize()` callback with proper user database + bcrypt password hashing. Add rate limiting on failed login attempts.
2. **Rotate NEXTAUTH_SECRET** - Generate 32+ char random secret for production. Add `.env` to `.gitignore` (keep `.env.example` tracked).
3. **Fix seed endpoint auth** - Require `SEED_SECRET` always (not just in production). Fail closed, not open.
4. **Validate MCP_URL** - Whitelist localhost URLs only. Reject external URLs in production.
5. **Add env var validation** - Zod schema check at app startup for all required variables.

### Tier 2: Maintainability Decomposition (High Impact)

6. **Decompose BattleManager** - Extract protocol handling, AI delegation, and set prediction into separate services. Target: under 300 lines for orchestrator.
7. **Split DamageCalculator** - Extract attacker/defender config pickers into components. Move calculation logic to `useDamageCalc()` hook.
8. **Separate GuidedBuilderProvider** - Move API orchestration to `useGuidedBuilderOrchestration()` hook. Keep provider as thin context wrapper.
9. **Add error boundaries** - Wrap battle, teams, and chat pages with `FeatureErrorBoundary`.
10. **Wrap GET routes in try-catch** - Ensure all 46 API routes consistently handle service errors.

### Tier 3: Performance Optimization (Medium Impact)

11. **Add global LRU cache for damage calc** - Persistent across requests, keyed by `[attacker, defender, move]`.
12. **Create lightweight browser entry for pokemon-data** - Avoid bundling full @pkmn/dex (~800KB) in client.
13. **Verify battle-engine client export tree-shakes** - Ensure `./client` subpath does not pull in @pkmn/sim.
14. **Optimize Pokemon search** - Consider pushing text filter + pagination to dex layer instead of loading all then filtering.

### Tier 4: Polish (Low Impact)

15. **Extract sample-teams.ts to JSON** - Replace 1,219-line TypeScript data file.
16. **Add `"type": "module"` to apps/web** - Match ESM convention of all other packages.
17. **Increase inline comments** in battle-engine AI (hint-engine, mcts-ai, heuristic-ai) to 8-10% density.
18. **Add JSDoc to React components and hooks** - Currently at 35-40% coverage; target 80%.
19. **Update 4 outdated packages** - Prisma, jsdom, turbo (all minor/patch updates).

---

## Conclusion

This is a **well-engineered codebase** that demonstrates strong architectural discipline, excellent type safety, and comprehensive testing. The primary risks are concentrated in **security** (dev-mode auth shortcuts that would be dangerous in production) rather than in code quality or architecture.

**Key strengths:**

- Zero circular dependencies across 14 packages
- Strict 5-layer dependency architecture with zero critical violations
- Only 1 `any` type in the entire codebase (in test code)
- 86% test-to-source line ratio
- 100% barrel export and README coverage

**Key risks:**

- Authentication is entirely cosmetic in dev mode and fragile in production
- 6 behavioral files exceed 500 lines and need decomposition
- Client bundles may include server-only libraries (~1.3MB)

**Estimated effort to address all Tier 1 + Tier 2 recommendations: 3-4 weeks** with one developer.
