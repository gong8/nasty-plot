# Gemini Codebase Audit Report

**Date:** 2026-02-14
**Auditor:** Gemini (Senior Staff Software Engineer & Security Auditor)

## 1. Executive Summary

The `nasty-plot` codebase is a high-quality, modern monorepo (Turborepo + pnpm) that strictly adheres to a "Service Pattern" architecture. It demonstrates a high level of engineering maturity with clear separation of concerns, strong typing (TypeScript), and a robust data model (Prisma).

**Overall Health Score: A-**

The system is well-architected for maintainability and scalability. The primary areas for improvement are **runtime input validation** (currently manual/loose) and **frontend React patterns** (some minor anti-patterns detected). Security risks are low due to the use of modern frameworks (Next.js, Prisma), though lack of strict API schemas is a minor vulnerability.

---

## 2. Architecture & Design (Score: A)

**Strengths:**

- **5-Layer Architecture:** The codebase strictly enforces a layered approach (Foundation -> Data -> Domain -> Feature -> Presentation), preventing circular dependencies and spaghetti code.
- **Service Pattern:** Domain logic is correctly encapsulated in pure functions within `packages/*/src/*.service.ts` (e.g., `team.service.ts`), decoupling logic from the persistence layer and the UI.
- **Monorepo Structure:** Clear boundaries between `packages/` (logic/data) and `apps/web` (UI).
- **Dependency Management:** `packages/db` is correctly treated as a leaf node in the dependency graph.

**Observations:**

- **Class "Anomalies":** While the mandate is "no classes", reasonable exceptions exist for stateful orchestrators like `BattleManager` and `ReplayEngine`. These are justified by the need to manage complex, persistent state (battle streams) that pure functions cannot easily handle.

---

## 3. Code Quality & Technical Debt (Score: B+)

**Strengths:**

- **Strong Typing:** `any` is virtually non-existent in the codebase.
- **Linting:** The project passes strict ESLint checks across almost all packages.
- **Testing:** Unit tests exist and are well-structured (using `vitest`), though they rely heavily on mocks (see below).

**Weaknesses:**

- **Frontend Anti-Patterns:**
  - `use-fetch-data.ts` calls `setState` synchronously within a `useEffect`, causing potential waterfall renders.
  - Some components use `<a>` tags instead of Next.js `<Link>`, bypassing client-side routing.
- **Test Reality:** Tests like `team.service.test.ts` mock `prisma`, meaning they verify the _service logic_ but not the _actual database queries_. Integration tests against a real DB are needed to guarantee query correctness.

---

## 4. Security Posture (Score: B)

**Strengths:**

- **ORM Usage:** Prisma prevents SQL injection by design.
- **Modern Framework:** Next.js provides built-in protection against XSS and other common web vulnerabilities.
- **No Hardcoded Secrets:** A scan revealed no obvious API keys or credentials committed to the repo.

**Risks:**

- **Weak API Validation:** API routes (e.g., `apps/web/src/app/api/teams/route.ts`) cast request bodies (`await request.json() as TeamCreateInput`) without runtime validation.
  - _Risk:_ A malicious user could send data that matches the JSON shape but contains invalid types or malicious payloads that might cause unexpected runtime errors or bypass logic checks.
  - _Recommendation:_ Adopt `zod` for runtime schema validation on all API inputs.

---

## 5. Performance & Scalability (Score: B+)

**Strengths:**

- **Eager Loading:** Service methods like `listTeams` correctly use Prisma's `include` to fetch related data (slots) in a single query, avoiding N+1 problems.
- **Indexing:** The `schema.prisma` file defines appropriate indices (`@@index`) for common lookup fields (`formatId`, `pokemonId`).

**Bottlenecks:**

- **N+1 in Maintenance:** The `cleanupEmptyTeams` function performs an N+1 operation (find all -> loop -> delete individually). While this is a background task, it could become slow if the DB grows large.
- **JSON Fields:** Using string fields to store JSON (e.g., in `SmogonSet`) bypasses DB-level optimizations and type safety, though SQLite supports JSON functions.

---

## 6. Maintainability (Score: A)

**Strengths:**

- **Clean Files:** Source files are generally small and focused.
- **Standardization:** Naming conventions (`*.service.ts`, `camelCase` IDs) are consistently applied.
- **Documentation:** Architecture docs are comprehensive.

---

## 7. Recommendations (Ranked)

### Critical (Immediate Action)

1.  **Fix React Side Effects:** Refactor `apps/web/src/lib/hooks/use-fetch-data.ts` to avoid synchronous state updates in `useEffect`. This fixes a lint error and potential bugs.
2.  **Fix Navigation Links:** Replace `<a>` tags with `next/link` in `TeamPicker.tsx` to restore SPA behavior.

### High (Next Sprint)

3.  **Implement Runtime Validation:** Introduce `zod` schemas for all API route inputs (e.g., `TeamCreateSchema`). Validate `request.json()` against these schemas before passing data to services.
4.  **Add Integration Tests:** Create a test suite that runs against the actual SQLite test database (using `pnpm db:push:test`) to verify Prisma queries, especially for complex filters.

### Medium (Tech Debt)

5.  **Refactor Maintenance Tasks:** Optimize `cleanupEmptyTeams` to use `deleteMany` with a `where` clause instead of iterating in application code.
6.  **Unused Code:** Remove unused variables (like `_` in `use-battle-animations.ts`) to clear lint warnings.

### Low (Long Term)

7.  **JSON Typing:** Consider stronger typing or a dedicated Prisma generator for the JSON fields in `SmogonSet` to prevent schema drift.
