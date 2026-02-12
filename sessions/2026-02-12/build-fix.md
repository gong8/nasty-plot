# Session: Fix Build Error in Smogon Data

**Date:** 2026-02-12
**Duration context:** short

## What was accomplished

- **Fixed Import Errors:** Removed `.js` extensions from local imports in `packages/smogon-data/src/smogon-sets.service.ts` and `packages/smogon-data/src/chaos-sets.service.ts`.
- **Verified Fix:** Ran typecheck for `@nasty-plot/smogon-data` and `@nasty-plot/llm` successfully.

## Key decisions & rationale

- **Removing Extensions:** The project configuration (`moduleResolution: bundler` in `tsconfig.base.json`) generally favors extensionless imports for TypeScript files. The build error explicitly stated it couldn't resolve the `.js` files.

## Files changed

- `packages/smogon-data/src/smogon-sets.service.ts`
- `packages/smogon-data/src/chaos-sets.service.ts`
