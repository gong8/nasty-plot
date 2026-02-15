# @nasty-plot/db

Prisma client singleton for the SQLite database. Uses the `better-sqlite3` driver adapter for synchronous, file-based storage.

## Key Exports

- **`prisma`** -- singleton `PrismaClient` instance, reused across hot reloads in development

## Schema

Defined in `prisma/schema.prisma` at the monorepo root. 14 models including `Team`, `TeamSlot`, `Battle`, `UsageStats`, `SmogonSet`, `SampleTeam`, and more.

## Dependencies

- `@prisma/client`, `@prisma/adapter-better-sqlite3`, `prisma`

No `@nasty-plot/*` dependencies (foundation layer alongside core).

## Usage

```typescript
import { prisma } from "@nasty-plot/db"

const teams = await prisma.team.findMany({ include: { slots: true } })
```

## Notes

- Database file at `prisma/dev.db`, generated client at `generated/prisma`
- After `prisma generate`, restart the dev server -- Turbopack caches the stale client
- The better-sqlite3 adapter does not support `$on` event-based query logging
