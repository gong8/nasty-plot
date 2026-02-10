# Test Coverage Boost Script

You are executing an automated test coverage improvement pipeline for a TypeScript monorepo. Follow each phase sequentially. Maximize parallelism within each phase.

## Phase 1: Run Tests & Fix Failures

Run the full test suite:

```
pnpm test
```

**If tests fail:**
1. Read each failing test file AND the source file it tests (in parallel)
2. Determine if the failure is due to:
   - Stale mocks (source was refactored but tests still mock old modules) → rewrite mocks to match current imports
   - Missing vitest config (`describe is not defined`) → create `vitest.config.ts` with `globals: true`
   - Broken assertions → fix assertions to match current behavior
3. Fix all failures, then re-run `pnpm test` to confirm green.

**If tests pass:** proceed to Phase 2.

**Do not proceed to Phase 2 until all tests are green.**

## Phase 2: Collect Coverage Baseline

First, ensure `@vitest/coverage-v8` is installed:

```
pnpm add -Dw @vitest/coverage-v8
```

Then run coverage for EVERY package that has test files. Run all packages in parallel using the Bash tool (one call per package, all in the same message):

```
cd packages/<name> && pnpm exec vitest run --coverage --coverage.provider=v8 --coverage.reporter=text --coverage.include='src/**/*.ts' --coverage.exclude='src/**/*.test.ts,src/__tests__/**'
```

For packages missing `vitest.config.ts`, create one first:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { globals: true } });
```

Collect results into a table like:

| Package | Stmts% | Branch% | Funcs% | Lines% | Uncovered Files |
|---------|--------|---------|--------|--------|-----------------|

## Phase 3: Deep Coverage Analysis

Analyze the coverage data to identify:

1. **Zero-coverage files** — files at 0% that are testable (exclude barrel `index.ts`, pure type files `types.ts`)
2. **Low-coverage packages** — packages below 80% statements
3. **Packages with no tests at all** — check every package in the monorepo
4. **High-value targets** — large files with low coverage that would move the needle most

Produce a prioritized work plan. Estimate how many new test files are needed and which source files each should cover. Group them by package.

## Phase 4: Parallel Coverage Boost

This is the main phase. Use `TeamCreate` to create a team called `coverage-boost`. Then create tasks with `TaskCreate` for every package that needs coverage work (one task per package or per source file for large packages).

Spawn **parallel agents** via the `Task` tool with `team_name: "coverage-boost"` — one agent per package. Each agent should:

1. Read the source file(s) it's responsible for
2. Read any existing tests in that package for style/convention reference
3. Write comprehensive tests covering:
   - All exported functions
   - Happy paths and edge cases
   - Error handling branches
   - Boundary conditions
4. Run the tests to verify they pass
5. Run coverage to verify improvement
6. Mark its task as completed

**Agent assignment strategy:**
- One agent per package for small packages (1-3 source files)
- Multiple agents per package for large packages (battle-engine, llm), split by subdirectory or file group
- Use `subagent_type: "general-purpose"` for all agents since they need to read, write, and run tests

**Example agent spawn:**
```
Task tool call:
  subagent_type: "general-purpose"
  team_name: "coverage-boost"
  name: "core-tests"
  prompt: |
    You are writing tests for the @nasty-plot/core package at /Users/gong/Programming/Projects/nasty-plot/packages/core.

    Your goal: achieve 95%+ statement coverage for this package.

    Steps:
    1. Read all source files in src/ (excluding test files)
    2. Read existing tests for style reference
    3. Identify uncovered code by reading the source carefully
    4. Write new test files or extend existing ones
    5. Run: cd packages/core && pnpm exec vitest run --coverage --coverage.provider=v8 --coverage.reporter=text
    6. If below 95%, add more tests and re-run
    7. Mark your task completed when done

    Conventions:
    - Use vitest globals (describe, it, expect, vi)
    - Place tests in src/__tests__/ or co-located as src/<name>.test.ts (match existing pattern)
    - Use factory functions for test data (makeX pattern)
    - Mock external dependencies with vi.mock()
    - Test edge cases: empty inputs, invalid data, boundary values
```

**Spawn as many agents as possible simultaneously.** Do NOT serialize — launch all package agents in a single message with multiple Task tool calls.

**Files that are inherently hard to test** (CLI entry points that spawn processes, barrel index.ts files, pure type definition files) can be excluded from coverage targets. Focus on service functions, utilities, and business logic.

## Phase 5: Verify & Report

After all agents complete:

1. Run the full test suite one final time: `pnpm test`
2. Run coverage for all packages again (in parallel)
3. Produce a final coverage report table
4. Compare before vs after
5. List any files still below 95% and explain why (e.g., "CLI entry point", "spawns child processes")

If overall coverage is below 95%, identify the remaining gaps and spawn another round of agents to close them.

## Guidelines

- **Test quality matters.** Don't write trivial tests that just call functions without meaningful assertions. Each test should verify specific behavior.
- **Mock at module boundaries.** Mock database calls, network requests, and child process spawns. Don't mock the code under test.
- **Follow existing patterns.** Read existing tests in each package before writing new ones. Match the style.
- **Don't modify source code** to improve coverage. Only write/fix tests.
- **Run tests after every change.** Never assume tests pass — verify.
- **Exclude from coverage targets:**
  - `index.ts` barrel files (just re-exports)
  - `types.ts` files (just type definitions, no runtime code)
  - CLI entry points that primarily spawn processes (e.g., `cli-chat.ts` which spawns `claude` CLI)
  - Files that require running external services (database, network)
