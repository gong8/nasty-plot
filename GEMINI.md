# Nasty Plot - Gemini Development Guide

## Project Context

Pokemon team building simplifier and competitive analysis teaching playground.
**Stack:** Turborepo + pnpm monorepo, Next.js 16 (App Router), TypeScript 5, React 19, Prisma/SQLite, Vitest.
**Scope:** Gen 9 (Scarlet/Violet) only. Smogon singles (OU, UU, etc.) + VGC doubles.

## Core Mandates

- **No Commits:** NEVER stage or commit changes unless explicitly instructed.
- **DB Sync:** Integration tests rely on manual schema sync. Run `pnpm --filter @sentinel/db db:push:test` after modifying `packages/db/prisma/schema.prisma`.
- **Conventions:** Follow the "Service Pattern" (pure functions in `*.service.ts`, no classes except AI players).
- **Style:** Use named exports, ESM everywhere (`"type": "module"`), and barrel exports in `src/index.ts`.
- **Testing:** All tests reside in the top-level `tests/` directory, mirroring the `packages/` structure.

## Architecture & Packages

- **apps/web:** Next.js frontend and API routes (`src/app/api/`).
- **packages/core:** Domain types (`TeamSlotData`), constants, Showdown parser.
- **packages/pokemon-data:** `@pkmn/dex` wrapper. Use `pokemonId` (camelCase) internally, `name` (Display Name) for `@smogon/calc`.
- **packages/db:** Prisma client singleton. Schema at `prisma/schema.prisma`.
- **packages/battle-engine:** `@pkmn/sim` integration, AI players, and protocol parsing.
- **packages/llm:** Chat services and MCP client integration.
- **packages/ui:** Shared Radix UI + Tailwind components.

## Key Domain Logic

- **Pokemon IDs:** Always use camelCase IDs (e.g., `greatTusk`) for logic.
- **Species Hydration:** Use `getSpecies(pokemonId)` from `@nasty-plot/pokemon-data`.
- **Stats:** Abbreviations are `hp, atk, def, spa, spd, spe`.
- **Damage Taken Encoding:** `@pkmn/dex` uses `0=neutral, 1=super effective, 2=resist, 3=immune`. **Be careful.**
- **Battle Protocol:** Showdown-style pipes (e.g., `|move|...`). Parsed in `battle-engine`.

## Development Workflow

1. **Understand:** Use `grep_search` and `glob` to find existing patterns. Read `package.json` and `tsconfig.json` to verify environment.
2. **Plan:** Share a concise plan. Confirm with the user if the request is ambiguous.
3. **Implement:** Use `replace` or `write_file`. Maintain strict ESM and barrel export conventions.
4. **Verify:**
   - Run tests: `pnpm test` or `pnpm --filter <pkg> test`.
   - Lint/Type-check: `pnpm run lint` or `pnpm exec tsc --noEmit`.
   - **Important:** Restart dev server after Prisma changes as Turbopack caches the client.

## Common Commands

```bash
pnpm dev              # Full dev stack (Next.js + MCP + Proxy)
pnpm test             # Run all tests
pnpm seed             # Sync Smogon usage data
pnpm db:push:test     # Sync test database (CRITICAL for integration tests)
pnpm db:generate      # Regenerate Prisma client
```

## Linear & Session Management

- **Linear:** Use `NAS` prefix. Move issues to `In Progress` when starting and `Done` when finished.
- **Sessions:** Document progress in `sessions/YYYY-MM-DD-{slug}.md`. Read recent sessions at startup to regain context.
- **Next Steps:** If the user asks what's next, check Linear (Todo/In Progress), `plans/`, and the latest `sessions/` notes.

## Technical Gotchas

- `@smogon/calc` requires `species.name` ("Great Tusk"), NOT `pokemonId` ("greatTusk").
- `TeamSlot` in DB flattens EVs/IVs (e.g., `evHp`, `evAtk`) and moves (`move1`-`move4`).
- Ensure all new packages are added to `pnpm-workspace.yaml` and have correct `exports` in `package.json`.
