# Nasty Plot

Pokemon team building tool and competitive analysis playground. Build teams, analyze matchups, calculate damage, and learn competitive Pokemon concepts.

Focused on Gen 9 (Scarlet/Violet) — Smogon singles formats (OU, UU, etc.) and VGC doubles.

## Features

- **Team Builder** — create and manage teams with a guided or freeform editor
- **Pokemon Browser** — search species, view stats, abilities, learnsets, and Smogon sets
- **Damage Calculator** — single calcs and full team matchup matrices via `@smogon/calc`
- **Type Coverage Analysis** — identify team weaknesses, resistances, and gaps
- **Usage Statistics** — Smogon usage data, teammate correlations, and meta trends
- **Battle Simulator** — run battles with AI players using `@pkmn/sim`
- **AI Chat** — LLM-powered teambuilding assistant with full tool access
- **MCP Server** — 24 tools and 5 resources for Claude integration

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **App:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Database:** Prisma + SQLite
- **Styling:** Tailwind CSS + Radix UI
- **Testing:** Vitest + React Testing Library
- **Pokemon Data:** `@pkmn/dex`, `@pkmn/sim`, `@pkmn/smogon`, `@smogon/calc`

## Getting Started

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm exec prisma generate

# Seed the database with Smogon usage data
pnpm seed

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to get started.

## Project Structure

```
apps/web/          Next.js app — UI and API routes
packages/
  core/            Domain types, type chart, stat calc, Showdown parser
  pokemon-data/    @pkmn/dex wrapper for species, moves, abilities
  formats/         Format definitions and legality checking
  smogon-data/     Usage stats and Smogon set fetching
  teams/           Team CRUD, validation, Showdown import/export
  analysis/        Type coverage, threat ID, synergy scoring
  damage-calc/     @smogon/calc wrapper, matchup matrices
  recommendations/ Pokemon suggestions (coverage, usage, composite)
  battle-engine/   @pkmn/sim battle simulator and AI players
  llm/             OpenAI chat service and context builder
  mcp-server/      MCP server for Claude integration
  ui/              Shared React components
  db/              Prisma client singleton
  data-pipeline/   Data seeding CLI
```

## License

MIT
