# Session: Audit Remediation

**Date:** 2026-02-15
**Duration context:** Long (multi-hour, 7 parallel agent team)

## What was accomplished

Full implementation of a 6-phase audit remediation plan to improve codebase grades from B- (6.6/10) to A- (9/10) across all dimensions. 121 files changed, +3697/-1086 lines.

### Phase 0: Corrected Audit Report

- Rewrote `AuditReport.md` with corrected metrics, removed 2 fabricated findings (H2 SSRF, H8 team service size), added Fact-Check Notes section
- Original audit moved to `plans/archived/GeminiAuditReport.md`

### Phase 1: Security Foundation (D -> A-)

- **Zod validation on 31 API routes** — created `apps/web/src/lib/validation.ts` with `validateBody()` and `validateSearchParams()` helpers. 8 schema files in `apps/web/src/lib/schemas/` (common, team, battle, chat, pokemon, format, sample-team, data)
- **Seed endpoint protection** — Bearer token check against `SEED_SECRET` env var in `apps/web/src/app/api/data/seed/route.ts`
- **Error sanitization** — 500 errors return generic "Internal server error" in `apps/web/src/lib/api-error.ts`
- **CORS middleware** — `apps/web/src/middleware.ts` with origin allowlist, OPTIONS preflight, headers on all API responses
- **Restricted child process env** — `packages/llm/src/cli-chat.service.ts` spawn uses explicit env allowlist (PATH, HOME, SHELL, TERM, NODE_ENV, MCP_URL) instead of `{ ...process.env }`
- **API key removed** — Deleted commented-out `OPENAI_API_KEY=sk-proj-...` from `.env`

### Phase 2: Performance (C -> A-)

- **Batch Smogon sync** — `usage-stats.service.ts` and `smogon-sets.service.ts` collect all upsert operations into arrays, execute via `prisma.$transaction()` in chunks of 500. Converted 5 individual save functions to `collect*` helpers returning PrismaPromise arrays
- **Batch slot operations** — `reorderSlots()` and `removeSlot()` in `team.service.ts` wrapped in `prisma.$transaction()`
- **TTL cache** — Created `packages/core/src/cache.ts` with `TTLCache<T>` class. Applied to `getUsageStats()` and `getSetsForPokemon()` with 5-min TTL, cleared on sync
- **Pagination** — `listTeams()`, `listSampleTeams()`, `listSessions()` now accept page/pageSize and return `{ data, total }`. Updated all frontend consumers
- **Select optimization** — `listBattles()` uses `BATTLE_LIST_SELECT` to skip heavy columns (protocolLog, pastes, commentary)

### Phase 3: Authentication

- **NextAuth.js** — Credentials provider with JWT sessions. `apps/web/src/lib/auth.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`, `apps/web/src/app/auth/signin/page.tsx`
- **Auth middleware** — JWT token check in `middleware.ts` for non-public routes. Public exceptions: GET pokemon/_, formats/_, items, auth/\*. **Auth only enforced in production** (`NODE_ENV === "production"`)
- **Rate limiting** — `apps/web/src/lib/rate-limit.ts` with sliding window per IP. 3 buckets: seed (1/10min), chat (20/min), default (100/min). Returns 429 with Retry-After header

### Phase 4: Maintainability (B -> A-)

- **75 frontend tests** across 11 files in `tests/ui/` — type-badge, stat-bar, pokemon-sprite, type-grid, ev-editor, search-combobox, move-selector, pokemon-search-selector, iv-editor, calculated-stats-display, utils
- **processLine refactor** — Extracted 22 named handler functions from protocol-parser.service.ts switch statement (handleMove, handleFaint, handleStatus, etc.)
- **BattleManager decomposition** — Extracted into 3 modules: `battle-ai-handler.ts`, `battle-request-handler.ts`, `battle-resume.ts`. BattleManager delegates to these
- **Silent catches fixed** — 11 `.catch(() => {})` replaced with `.catch((err) => console.error("[context]:", err))` across 5 files. 1 legitimate JSON parse fallback remains
- **Config validation** — `packages/core/src/env.ts` with `validateEnv()` for required/optional env vars

### Phase 5: Code Quality (B+ -> A)

- **Type guards** — 4 type guard functions in protocol-parser.service.ts (`isStatusCondition`, `isPokemonType`, `isSide`, `isBoostStat`) replacing `as` casts
- **14 package READMEs** — Created README.md for every package

### Phase 6: Architecture Polish (A- -> A)

- **O(n^2) synergy documentation** — Comment in `synergy.service.ts` documenting complexity bound
- **Prisma logging note** — Comment in `packages/db/src/client.ts` about better-sqlite3 adapter not supporting `$on`

## Key decisions & rationale

- **Auth disabled in dev mode** — Auth middleware only enforces in `NODE_ENV === "production"`. The user's local data became invisible after auth was added, so we made it dev-optional to avoid friction
- **Seed endpoint conditionally protected** — `SEED_SECRET` check is `if (expectedToken && ...)`, meaning if env var is unset the endpoint is open. Intentional for dev convenience; must be set in production
- **TTL cache over Redis** — Simple in-memory `TTLCache` class in core package. Appropriate for single-process SQLite app; no external dependencies needed
- **Pagination response shape** — All paginated endpoints return `{ data, total, page, pageSize }`. Frontend consumers updated to unwrap `.data`
- **jsdom as global test environment** — Set in vitest.config.ts for UI component tests. LLM tests opt out via `// @vitest-environment node` directive per-file
- **BattleManager not fully decomposed** — Extracted 3 modules but BattleManager still ~375 lines. The class legitimately manages complex persistent state (battle streams) that pure functions can't easily handle

## Bugs found & fixed

1. **Auth blocking all data in dev** — After adding NextAuth middleware, all non-public API routes returned 401. User couldn't see any data. Fixed by making auth production-only.

2. **LLM tests (39 failures)** — Global `environment: "jsdom"` in vitest.config.ts broke `tests/llm/cli-chat.test.ts` (35 failures) and `tests/llm/openai-client.test.ts` (4 failures). OpenAI SDK detected jsdom as browser and threw. Fixed with `// @vitest-environment node` directives and `Element` guard in setup.ts.

3. **Public route matching** — `isPublicRoute` used `startsWith("/api/pokemon/")` (trailing slash), meaning `GET /api/pokemon` (no trailing slash) would incorrectly require auth. Fixed to match both `=== "/api/pokemon"` and `startsWith("/api/pokemon/")`.

4. **Pagination breaking frontend** — `listTeams`, `listSampleTeams`, `listSessions` changed from returning arrays to `{ data, total }`. All frontend consumers had to be updated to unwrap `.data`.

5. **TTL cache test leaks** — Cache instances persisted across tests. Fixed by mocking `TTLCache` with no-op class in smogon-data test files.

6. **$transaction mock missing** — Batch refactor added `$transaction` calls but test mocks didn't include it. Fixed by adding `$transaction: vi.fn((ops) => Promise.all(ops))`.

7. **Build errors (7+)** — Server-only module leak (`@nasty-plot/formats` barrel re-exported Prisma), `request.ip` removed in Next.js 16, missing `NODE_ENV` in spawn env, Zod output type incompatibilities. All fixed during build verification.

## Pitfalls & gotchas encountered

- **jsdom + Node.js test coexistence** — Setting `environment: "jsdom"` globally breaks tests that depend on Node.js APIs (child_process, OpenAI SDK browser detection). Use per-file `// @vitest-environment node` overrides for server-side tests
- **`tests/setup.ts` must be env-safe** — The setup file runs for ALL tests including node-environment ones. Any references to jsdom globals like `Element` must be guarded with `typeof globalThis.Element !== "undefined"`
- **Prisma better-sqlite3 adapter limitations** — Does not support `$on` event logging (query events require Prisma engine, not driver adapter)
- **Next.js 16 removed `request.ip`** — Must use `x-forwarded-for` header instead
- **Barrel exports can leak server code to client** — `@nasty-plot/formats` barrel exported `ensureFormatExists` which imports Prisma/better-sqlite3, causing bundler errors in client pages. Fixed by removing from barrel and using direct `@nasty-plot/formats/db` import path

## Files changed

**121 files total** across the commit. Key categories:

### New files created

- `apps/web/src/middleware.ts` — CORS, rate limiting, auth
- `apps/web/src/lib/validation.ts` — Zod validation helpers
- `apps/web/src/lib/schemas/*.ts` — 8 schema files (common, team, battle, chat, pokemon, format, sample-team, data)
- `apps/web/src/lib/auth.ts` — NextAuth config
- `apps/web/src/lib/rate-limit.ts` — Sliding window rate limiter
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` — Auth API route
- `apps/web/src/app/auth/signin/page.tsx` — Sign-in page
- `packages/core/src/cache.ts` — TTLCache class
- `packages/core/src/env.ts` — Environment validation
- `packages/battle-engine/src/battle-ai-handler.ts` — Extracted AI handling
- `packages/battle-engine/src/battle-request-handler.ts` — Extracted request handling
- `packages/battle-engine/src/battle-resume.ts` — Extracted resume logic
- `packages/*/README.md` — 14 package READMEs
- `tests/setup.ts` — Test setup (jest-dom, ResizeObserver, Element stubs)
- `tests/ui/*.test.tsx` — 10 UI component test files + 1 utils test

### Modified files

- All 31 validated API route files in `apps/web/src/app/api/`
- `packages/smogon-data/src/usage-stats.service.ts` — Batch sync + caching
- `packages/smogon-data/src/smogon-sets.service.ts` — Batch sync + caching
- `packages/teams/src/team.service.ts` — Batch slots + pagination
- `packages/teams/src/sample-team.service.ts` — Pagination
- `packages/llm/src/chat-session.service.ts` — Pagination
- `packages/llm/src/cli-chat.service.ts` — Restricted env
- `packages/battle-engine/src/protocol-parser.service.ts` — Handler extraction + type guards
- `packages/battle-engine/src/battle-manager.service.ts` — Decomposition
- `packages/core/src/index.ts` — Barrel exports for cache + env
- `vitest.config.ts` — jsdom environment + setup file
- `.env` / `.env.example` — NextAuth vars, removed API key
- `AuditReport.md` — Corrected metrics
- 8 test files updated for new response shapes and mocks

## Known issues & next steps

- **Auth is dev-disabled** — `NODE_ENV === "production"` gate means no auth in dev. Production deployment needs `NEXTAUTH_SECRET` (real secret) and `SEED_SECRET` set
- **Frontend test coverage** — 75 UI tests is a good start but plan targeted 50% coverage including hooks and feature component tests (use-team-builder, use-battle, use-chat-stream, battle-screen, team-grid, etc.)
- **Integration tests** — All tests mock Prisma. No integration tests against real SQLite DB. The audit recommended this for query correctness verification
- **Credentials provider is placeholder** — Auth accepts any non-empty username/password. Needs real user storage (Prisma User model) or OAuth provider for production
- **`cleanupEmptyTeams` N+1** — Still iterates and deletes individually. Could be optimized to `deleteMany` with a `where` clause
- **JSON fields in SmogonSet** — Still using string columns for JSON (moves, evs, ivs). Works but bypasses DB-level type safety
- **Type assertions still ~600+** — Reduced from ~920 but many remain at package boundaries (@pkmn/dex casts, DB boundary casts). Most are acceptable boundary casts

## Tech notes

- **TTLCache usage pattern** — Import from `@nasty-plot/core`, instantiate with TTL in ms, call `.clear()` after sync operations. Cache is per-process (no shared state across workers)
- **Zod validation pattern** — `const [data, errorResponse] = await validateBody(request, schema); if (errorResponse) return errorResponse;` — tuple return eliminates try/catch for validation
- **Rate limiter cleanup** — Runs `setInterval` every 60s to remove stale entries. In-memory only, resets on server restart
- **vitest environment override** — `// @vitest-environment node` must be the very first line (or first comment) of the test file. Works alongside global `environment: "jsdom"` in config
- **Pagination response type** — `{ data: T[], total: number, page: number, pageSize: number }`. Frontend hooks unwrap via `response.data` and use `total` for pagination UI
- **BattleManager decomposition imports** — Uses aliased imports to avoid name collisions: `import { handleAITurn as aiHandleTurn }`. BattleManager implements `ResumableManager` interface from battle-resume.ts
