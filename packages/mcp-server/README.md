# @nasty-plot/mcp-server

MCP (Model Context Protocol) server exposing 24 tools and 5 resources for Claude integration. Runs as an Express server on port 3001.

## Tool Modules (24 tools)

- **Data Query** (7) -- `get_pokemon`, `search_pokemon`, `get_moves_by_criteria`, `get_abilities`, `compare_pokemon`, `get_type_matchups`, `get_smogon_sets`
- **Analysis** (6) -- `analyze_team_coverage`, `find_team_weaknesses`, `get_speed_tiers`, `calculate_damage`, `suggest_counters`, `get_common_cores`
- **Team CRUD** (6) -- `create_team`, `get_team`, `list_teams`, `add_pokemon_to_team`, `update_pokemon_set`, `remove_pokemon_from_team`
- **Meta Recs** (5) -- `get_meta_trends`, `get_format_viability`, `get_usage_stats`, `suggest_teammates`, `suggest_sets`

## Resources (5)

`pokemon://type-chart`, `pokemon://formats`, `pokemon://natures`, `pokemon://stat-formulas`, `pokemon://viability/{formatId}`

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/formats`
- `@modelcontextprotocol/sdk`, `express`, `zod`

## Usage

```bash
# Start the MCP server
pnpm dev:mcp

# Health check
curl http://localhost:3001/health
```

Tools call the Next.js API internally (`http://localhost:3000`), so the web app must be running.
