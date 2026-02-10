# Session: Project Naming — "Nasty Plot"
**Date:** 2026-02-10
**Duration context:** Short

## What was accomplished
- Explored the full scope of the project to understand what it does (team builder, battle simulator, chess-engine-style analysis, batch simulation, AI opponents, Smogon data pipeline, MCP server, LLM integration)
- Brainstormed ~60+ candidate project names across multiple themes: forging/crafting, hacking, strategy, Pokemon moves/abilities/items, science/lab, competitive lingo
- Verified availability of candidates against existing Pokemon tools, websites, GitHub repos, npm packages, and domain registrations
- Settled on **Nasty Plot** (`nasty-plot`) as the project name

## Key decisions & rationale
- **Name: Nasty Plot** — A real Pokemon move (Dark-type, +2 Special Attack) that means "scheming/plotting strategy." Perfect double meaning: the app is literally for plotting competitive strategy. It's fun, immediately recognizable to Pokemon players, and has the right casual/open-source project energy.
- **Rejected "PokeForge"** — User's initial favorite, but heavily taken (pokeforge.com, multiple GitHub repos, TCG tool)
- **Rejected "SuperEffective"** — Also taken (supereffective.gg, supereffectiveapp.com, iOS app)
- **Moved away from "Poke + X" pattern** — User wanted something more creative than a generic prefix compound
- **Moved away from corporate/hackery vibes** — User clarified they wanted something Pokemon-flavored, fun, and suited to a casual open-source project
- **Availability confirmed** — No Pokemon tool/site/app uses the name. No relevant GitHub repos, npm packages, or registered domains (nastyplot.com/.gg/.dev all appear available)

## Files changed
- `sessions/2026-02-10-project-naming.md` (created)

## Known issues & next steps
- Register domain(s) if desired (nastyplot.com, nastyplot.gg, nastyplot.dev, nasty-plot.dev)
- Rename the monorepo from `nasty-plot` to `nasty-plot`
- Update package.json name, turbo config, workspace references, Linear team name, CLAUDE.md, etc.
- Consider a tagline/description (e.g. "competitive Pokemon team builder and battle analysis engine")

## Tech notes
- The current repo name is `nasty-plot` with npm workspace prefix `@nasty-plot/`
- Renaming will touch: root package.json, all packages/*/package.json workspace names, turbo.json, CLAUDE.md, any import references using the `@nasty-plot/` prefix
- Linear team is currently named `nasty-plot` with prefix `POK` — may want to update
