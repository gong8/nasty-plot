# Session: Test Migration to Top-Level Directory

**Date:** 2026-02-10
**Duration context:** Long (continuation of a previous session that ran out of context)

## What was accomplished

- Migrated all 43 test files from scattered locations in `packages/*/src/__tests__/` and co-located `*.test.ts` to a unified top-level `tests/` directory
- Created single root `vitest.config.ts` with `@nasty-plot/*` barrel alias and `#pkg/module` sibling mock alias
- Created `tests/tsconfig.json` with path mappings for TypeScript support
- Rewrote imports in all 43 test files: relative imports became `@nasty-plot/<pkg>` barrels, sibling mocks became `#<pkg>/<module>` aliases
- Deleted all original test files from packages (42 files)
- Deleted 11 per-package `vitest.config.ts` files
- Removed `vitest` devDependency from all 11 package.json files
- Removed `"test"` scripts from 7 package.json files
- Updated root `package.json` to use `vitest run` directly instead of `turbo test`
- Removed `"test"` task from `turbo.json`
- Updated `CLAUDE.md` with new test conventions and architecture description
- All 43 files / 1190 tests passing

## Key decisions & rationale

- **Barrel imports for module under test**: Tests import from `@nasty-plot/<pkg>` barrels rather than direct source paths. All tested symbols were already exported from barrels, so no barrel changes needed.
- **`#pkg/module` alias for sibling mocks**: `vi.mock("#analysis/coverage.service", ...)` pattern avoids relative path fragility while clearly indicating intra-package mocking. Alias maps to `packages/<pkg>/src/<module>` via vitest `resolve.alias`.
- **Root devDependencies for mocked third-party packages**: Added `@pkmn/sim`, `@pkmn/dex`, `@modelcontextprotocol/sdk` at root because pnpm strict isolation prevents `vi.mock()` from resolving packages that only exist in sub-package `node_modules`.
- **Vitest directly instead of turbo**: Since all tests are now in one location with one config, there's no need for turbo to orchestrate per-package test runs. Vitest handles parallelism internally.

## Bugs found & fixed

- **6 test files failing after initial migration** (46 test failures): `vi.mock("@pkmn/sim")`, `vi.mock("@pkmn/dex")`, and `vi.mock("@modelcontextprotocol/sdk/...")` couldn't resolve these packages from the project root due to pnpm strict module isolation. Fixed by installing them as root devDependencies.
- **40 of 43 test files failing initially**: `@nasty-plot/*` workspace packages weren't resolvable from root. Fixed by adding the `@nasty-plot/*` alias to `vitest.config.ts` that maps to `packages/*/src/index.ts`.

## Pitfalls & gotchas encountered

- **pnpm strict isolation + vi.mock()**: This was the biggest gotcha. When running vitest from root, `vi.mock("@pkmn/sim")` resolves the mock path relative to the test file (at root). But `@pkmn/sim` is only a dependency of `packages/battle-engine`, not the root. pnpm won't let root resolve it. The mock registers for a non-existent module while the actual code imports the real one from the package's `node_modules`. Solution: install mocked third-party packages as root devDependencies.
- **Some mocked-package tests passed despite the resolution issue**: Tests like `analysis.service.test.ts` mock `@pkmn/dex` but still passed because they also mock all sibling services via `#analysis/*`, preventing the code from ever reaching `@pkmn/dex` calls. This masked the underlying resolution problem.
- **vitest not installed at root**: Had to run `pnpm add -Dw vitest` (the `-w` flag is required for workspace root installs).

## Files changed

### Created

- `tests/` directory with 11 subdirectories and 43 test files
- `tests/tsconfig.json`
- `vitest.config.ts` (root)

### Modified

- `package.json` (root) — test scripts, devDependencies
- `turbo.json` — removed test task
- `CLAUDE.md` — test conventions
- 11 `packages/*/package.json` — removed vitest devDep and test scripts

### Deleted

- 42 test files from `packages/*/src/__tests__/` and co-located locations
- 11 `packages/*/vitest.config.ts` files
- All empty `__tests__/` directories in packages

## Known issues & next steps

- No test files exist yet for `apps/web/` (component tests, API route tests) — those would need their own vitest config with jsdom environment if added
- The `tests/tsconfig.json` TypeScript check (`npx tsc -p tests/tsconfig.json --noEmit`) was not run — worth verifying in a future session
- Consider adding the `tests/` directory structure to a `.gitkeep` or documenting it so empty subdirs are preserved

## Tech notes

- **Alias patterns in vitest.config.ts**:
  - `@nasty-plot/<pkg>` → `packages/<pkg>/src/index.ts` (barrel imports)
  - `#<pkg>/<module>` → `packages/<pkg>/src/<module>` (sibling module mocks)
- **Mock resolution in pnpm workspaces**: `vi.mock("some-package")` resolves the package specifier from the test file's location. In a pnpm workspace, sub-package dependencies aren't available at root. Any third-party package that tests mock must be installed at root for mocks to work.
- **Test count**: 43 files, 1190 tests, ~4.7s runtime (very fast due to heavy mocking)
- **8 test files had complex sibling mock rewrites** (21 total mock path changes): analysis.service, chat.service, composite-recommender, import-export.service, format.service, automated-battle-manager, batch-simulator, replay-engine
