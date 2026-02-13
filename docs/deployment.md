# Deployment

## Architecture Overview

Nasty Plot requires **3 concurrent processes** and a **persistent filesystem**, making it incompatible with serverless platforms (Vercel, Netlify, etc.).

| Process          | Port | What It Does                                            |
| ---------------- | ---- | ------------------------------------------------------- |
| Next.js          | 3000 | Web UI + API routes                                     |
| MCP Server       | 3001 | Express server exposing 24 tools for Claude integration |
| Claude API Proxy | 3456 | OpenAI-compatible proxy wrapping the `claude` CLI       |

### Why Not Serverless?

- **SQLite + `better-sqlite3`** — native C addon, needs a persistent writable filesystem
- **`spawn("claude", ...)`** — chat service spawns the Claude CLI as a child process
- **MCP server** — stateful Express server holding sessions in memory
- **MCP → Next.js localhost loop** — MCP server calls `http://localhost:3000/api`

## Railway Deployment

Railway is the recommended platform. It provides persistent volumes, long-running processes, and a straightforward Docker-based deployment.

### Prerequisites

- [Railway account](https://railway.com)
- Railway CLI (`npm i -g @railway/cli`)
- Claude CLI installed and authenticated (for the API proxy)

### Setup

1. **Create a new Railway project**

   ```bash
   railway login
   railway init
   ```

2. **Add a persistent volume** for the SQLite database. In the Railway dashboard, attach a volume and mount it at `/data`. You'll point `DATABASE_URL` at this path.

3. **Set environment variables** in Railway dashboard or via CLI:

   ```
   DATABASE_URL=file:/data/nasty-plot.db
   NODE_ENV=production
   MCP_PORT=3001
   MCP_URL=http://localhost:3001/mcp
   LLM_BASE_URL=http://localhost:3456/v1
   LLM_MODEL=claude-opus-4-6
   LLM_API_KEY=not-needed
   ```

   If using OpenAI directly instead of the Claude proxy, set these instead:

   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o
   ```

4. **Deploy**

   ```bash
   railway up
   ```

### Dockerfile

Railway auto-detects Dockerfiles. Create one at the repo root:

```dockerfile
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/pokemon-data/package.json packages/pokemon-data/
COPY packages/formats/package.json packages/formats/
COPY packages/smogon-data/package.json packages/smogon-data/
COPY packages/data-pipeline/package.json packages/data-pipeline/
COPY packages/teams/package.json packages/teams/
COPY packages/analysis/package.json packages/analysis/
COPY packages/damage-calc/package.json packages/damage-calc/
COPY packages/recommendations/package.json packages/recommendations/
COPY packages/llm/package.json packages/llm/
COPY packages/battle-engine/package.json packages/battle-engine/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY prisma/ prisma/
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm db:generate
RUN pnpm build

# Seed database on first run, then start all services
EXPOSE 3000 3001
CMD ["sh", "-c", "pnpm db:push && concurrently 'node apps/web/.next/standalone/server.js' 'node --import tsx packages/mcp-server/src/index.ts'"]
```

> **Note:** The Claude API proxy (`claude-max-api-proxy`) requires the Claude CLI to be installed and authenticated interactively. For production, consider replacing it with direct Anthropic SDK calls using an `ANTHROPIC_API_KEY`, or use the OpenAI fallback path with `OPENAI_API_KEY`.

### Database Seeding

The database starts empty. After first deploy, seed it via Railway's shell:

```bash
railway run pnpm seed
```

This pulls Smogon usage stats, sets, and teammate correlations. The database file will persist on the mounted volume across deploys.

### Health Check

Railway can ping `GET /` or any page route to verify the app is running. The Next.js app serves on port 3000 by default — set this as the health check port in Railway.

## Alternative Platforms

Any platform that supports **long-running Node.js processes** and **persistent disk** will work:

| Platform                      | Volume Support | Notes                                                         |
| ----------------------------- | -------------- | ------------------------------------------------------------- |
| **Railway**                   | Yes            | Recommended. Simple setup, good monorepo support              |
| **Render**                    | Yes (on paid)  | Docker or native Node.js, persistent disks on paid plans      |
| **Fly.io**                    | Yes            | Volumes via `fly volumes create`, good for multi-process apps |
| **DigitalOcean App Platform** | Limited        | Better to use a Droplet with Docker Compose                   |
| **VPS (any)**                 | Yes            | Most flexible. Use Docker Compose or PM2                      |

## Future: Proper Cloud Deployment

To make the app fully cloud-native (and unlock serverless for the Next.js frontend), these changes would be needed:

1. **SQLite → Postgres** — swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg`, use Supabase/Neon/RDS
2. **Claude CLI spawn → Anthropic SDK** — replace `spawn("claude", ...)` in `packages/llm/src/cli-chat.ts` with direct API calls using `@anthropic-ai/sdk`
3. **MCP session state → Redis** — move the in-memory session `Map` to Upstash Redis or similar
4. **Split services** — deploy Next.js to Vercel, MCP server + battle engine as a separate service
