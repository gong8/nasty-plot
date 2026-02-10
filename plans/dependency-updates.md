# Dependency Update Plan

> Generated: 2026-02-10
> Sources: npm registry (latest versions), Context7 documentation (breaking changes)

## Overview

Full audit of every dependency across the monorepo. 46 unique external packages inventoried.
30 are already at latest. 16 need updates — 5 are major version bumps with breaking changes.

---

## Phase 0: Fix Version Inconsistencies (No Upgrade)

Several packages have inconsistent version ranges across workspaces. Align these first.

| Package | Where | Current | Align To |
|---------|-------|---------|----------|
| `vitest` | `data-pipeline`, `teams`, `recommendations`, `llm` | `^3.0.0` | `^4.0.18` |
| `typescript` | `data-pipeline`, `teams`, `recommendations`, `llm`, `mcp-server` | `^5.0.0` / `^5.9.3` | `^5.9.3` |
| `@pkmn/dex` | `recommendations` | `^0.8.0` | `^0.10.6` |

### Files to edit
- `packages/data-pipeline/package.json` — vitest, typescript
- `packages/teams/package.json` — vitest, typescript
- `packages/recommendations/package.json` — vitest, typescript, @pkmn/dex
- `packages/llm/package.json` — vitest, typescript
- `packages/mcp-server/package.json` — typescript

### Steps
1. Update all version strings
2. `npm install` from root
3. `npm run test` — confirm nothing broke

---

## Phase 1: Safe Minor/Patch Updates (No Breaking Changes)

These are all within semver-compatible ranges or trivial patch bumps. Zero risk.

| Package | Current | Latest | Location(s) |
|---------|---------|--------|-------------|
| `react` | `19.2.3` | `19.2.4` | `apps/web`, `packages/ui` |
| `react-dom` | `19.2.3` | `19.2.4` | `apps/web` |
| `turbo` | `^2.0.0` | `2.8.3` | root |
| `@tailwindcss/postcss` | `^4` | `4.1.18` | `apps/web` |
| `tailwindcss` | `^4` | `4.1.18` | `apps/web` |
| `@types/react` | `^19` | `19.2.13` | `apps/web` |
| `@types/react-dom` | `^19` | `19.2.3` | `apps/web` |
| `@types/express` | `^5.0.0` | `5.0.6` | `packages/mcp-server` |
| `tsx` | `^4.0.0` / `^4.21.0` | `4.21.0` | `packages/data-pipeline`, `packages/mcp-server` |

### Steps
1. Update version strings in all affected `package.json` files
2. `npm install` from root
3. `npm run build` — confirm compilation
4. `npm run test` — confirm tests pass

---

## Phase 2: `@types/node` ^20 → ^25 (Major)

**Risk: LOW** — Type-only package, no runtime behavior change. The major version tracks Node.js releases. `@types/node@25` corresponds to Node.js 25.x type definitions.

**Consideration:** If your runtime Node.js version is < 25, some new types may reference APIs that don't exist at runtime. However, since Next.js and the project don't use bleeding-edge Node APIs, this is low risk.

### Changes
- New type definitions for Node.js 22-25 APIs (WebSocket, `node:sqlite`, etc.)
- Some deprecated API types removed
- Stricter typing on some existing APIs

### Files to edit
- `apps/web/package.json` — `@types/node`: `^20` → `^22` (match your runtime Node version)

### Steps
1. Check your Node.js runtime version: `node -v`
2. Set `@types/node` to match your runtime major version (e.g., `^22` for Node 22.x)
3. `npm install`
4. `npm run build` — fix any type errors
5. `npm run test`

---

## Phase 3: `@types/uuid` ^10 → ^11 (Major)

**Risk: LOW** — Type-only update. The `uuid` package itself is at v13 already.

### Changes
- Types updated to match uuid v11+ API surface
- Minor signature adjustments

### Files to edit
- `apps/web/package.json` — `@types/uuid`: `^10.0.0` → `^11.0.0`

### Steps
1. Update version
2. `npm install`
3. `npm run build` — fix any type errors (likely none)
4. `npm run test`

---

## Phase 4: `eslint` ^9 → 10.0.0 (Major)

**Risk: MEDIUM** — ESLint 10 has real breaking changes, but the project already uses flat config (`eslint.config.js`), which mitigates the biggest one.

### Breaking Changes (from Context7)
1. **Old `.eslintrc` config format fully removed** — no longer usable even with `ESLINT_USE_FLAT_CONFIG=false`. Already on flat config, so no impact.
2. **`v10_config_lookup_from_file` flag removed** — config lookup from linted file directory is now default. Remove any usage of this flag if present.
3. **Deprecated `SourceCode` methods removed** — `getTokenOrCommentBefore`, `getTokenOrCommentAfter`, `isSpaceBetweenTokens`, `getJSDocComment`. Only affects custom rules.
4. **`FlatESLint` and `LegacyESLint` classes removed** — use `ESLint` class directly.
5. **`nodeType` property removed from `LintMessage` objects**.
6. **Migration tool available:** `npx eslint-transforms v9-rule-migration` for custom rules.

### Compatibility
- `eslint-config-next` 16.1.6 may not yet support ESLint 10. **Check peer dependencies before upgrading.**

### Files to edit
- `apps/web/package.json` — `eslint`: `^9` → `^10.0.0`

### Steps
1. Check `eslint-config-next` peer deps: `npm info eslint-config-next@16.1.6 peerDependencies`
2. If `eslint-config-next` doesn't support ESLint 10, **defer this update** until it does
3. If compatible:
   a. Update version
   b. `npm install`
   c. Remove any `ESLINT_USE_FLAT_CONFIG` or `v10_config_lookup_from_file` flags
   d. `npx eslint .` — fix any lint issues
   e. `npm run build && npm run test`

---

## Phase 5: `express` ^4.21.0 → 5.2.1 (Major)

**Risk: MEDIUM** — Express 5 has breaking changes, but the MCP server uses Express minimally (just middleware + route handlers).

### Breaking Changes (from Context7)
1. **`app.router` removed** — already implicit in Express 4.x, no impact if not referenced
2. **`res.send(status, body)` removed** — use `res.status(status).send(body)`. Project uses `NextResponse` for the web app; only MCP server uses Express.
3. **`res.json(status, obj)` removed** — use `res.status(status).json(obj)`
4. **`res.send(status)` removed** — use `res.sendStatus(status)`
5. **`res.location` no longer resolves relative URLs**
6. **Bundled middleware removed** (except `express.static`) — install separately
7. **`app.configure()` removed** — use conditional logic
8. **`req.host` returns full host** (with port)
9. **Promise-based route handlers** — rejected promises automatically call `next(err)`

### Scope
Only affects `packages/mcp-server/src/index.ts` and related files. Audit for:
- `res.send(statusCode, body)` patterns
- `res.json(statusCode, body)` patterns
- Any bundled middleware usage

### Files to edit
- `packages/mcp-server/package.json` — `express`: `^4.21.0` → `^5.2.1`
- `packages/mcp-server/src/index.ts` — fix any deprecated patterns

### Steps
1. Update version
2. `npm install`
3. Audit `packages/mcp-server/src/` for deprecated patterns
4. Fix any `res.send(status, body)` → `res.status(status).send(body)`
5. Test MCP server: `npm run dev:mcp`
6. Verify tools still work via Claude Desktop or MCP Inspector

---

## Phase 6: `openai` ^4.0.0 → ^6.19.0 (Major)

**Risk: HIGH** — Two major version jumps (4 → 5 → 6). This is the riskiest update.

### Breaking Changes (from Context7 — v6 MIGRATION.md)
1. **Beta namespace consolidation** — `client.beta.chat.completions.parse()` → `client.chat.completions.parse()`
2. **Resource class imports changed** — `const { Completions } = require('openai')` no longer works; use `import { OpenAI } from 'openai'` then `OpenAI.Completions`
3. **`.del()` methods renamed to `.delete()`** across all resources
4. **`.runFunctions()` removed** — use `.runTools()` instead
5. **`APIClient` base class removed** — use `OpenAI` directly
6. **Type imports relocated** — `openai/resources/beta/chat/completions` → `openai/resources/chat/completions`

### Scope
- `packages/llm/src/openai-client.ts` — main client instantiation
- `packages/llm/src/chat.service.ts` — chat completion calls
- `packages/llm/src/context-builder.ts` — may reference types

### Files to edit
- `packages/llm/package.json` — `openai`: `^4.0.0` → `^6.19.0`
- `packages/llm/src/openai-client.ts` — update client initialization, imports
- `packages/llm/src/chat.service.ts` — update API calls
- `packages/llm/src/context-builder.ts` — update type imports if needed

### Steps
1. Update version in `package.json`
2. `npm install`
3. Read `packages/llm/src/openai-client.ts` and audit for:
   - `APIClient` imports → replace with `OpenAI`
   - Any beta namespace usage → move to main namespace
   - Any `.del()` calls → rename to `.delete()`
   - Any `runFunctions()` → rename to `runTools()`
4. Read `packages/llm/src/chat.service.ts` and update:
   - Chat completion calls (beta → main namespace)
   - Type imports (update import paths)
5. `npm run build` — fix all type errors
6. `npm run test` — run LLM package tests
7. Manual test: start dev server, open chat interface, send a message

---

## Phase 7: Lockfile & Final Verification

### Steps
1. Delete `node_modules` and `package-lock.json`
2. `npm install` — fresh install
3. `npm run build` — full build
4. `npm run test` — full test suite
5. `npm run dev` — smoke test the app
6. `npm run dev:mcp` — smoke test the MCP server
7. Commit all changes

---

## Summary Table

| Phase | Packages | Risk | Breaking? |
|-------|----------|------|-----------|
| 0 | vitest, typescript, @pkmn/dex (align versions) | None | No |
| 1 | react, react-dom, turbo, tailwind, tsx, @types/* | None | No |
| 2 | @types/node ^20 → ^22+ | Low | Types only |
| 3 | @types/uuid ^10 → ^11 | Low | Types only |
| 4 | eslint ^9 → 10 | Medium | Yes — flat config only, methods removed |
| 5 | express ^4 → 5 | Medium | Yes — API signature changes |
| 6 | openai ^4 → ^6 | High | Yes — namespace reorganization, API renames |
| 7 | Clean install + full verification | None | N/A |

## Already at Latest (No Action Needed)

These 30 packages are already at their latest versions:

`prisma`, `concurrently`, `class-variance-authority`, `clsx`, `cmdk`, `lucide-react`, `next`, `next-themes`, `radix-ui`, `tailwind-merge`, `uuid`, `zod`, `@testing-library/jest-dom`, `@testing-library/react`, `@vitejs/plugin-react`, `@vitest/coverage-v8`, `eslint-config-next`, `jsdom`, `shadcn`, `tw-animate-css`, `vitest`, `@prisma/client`, `@prisma/adapter-better-sqlite3`, `@pkmn/dex`, `@pkmn/data`, `@pkmn/smogon`, `@smogon/calc`, `@pkmn/sim`, `@modelcontextprotocol/sdk`, `@pkmn/img`, `@tanstack/react-query`
