import { TOOL_CATEGORIES } from "./tool-context"

const MCP_PREFIX = "mcp__nasty-plot__"

/** All tool names derived from TOOL_CATEGORIES (single source of truth) */
const ALL_TOOL_NAMES = Object.values(TOOL_CATEGORIES).flat()

const TOOL_LABEL_MAP: Record<string, string> = {
  // data-query tools
  get_pokemon: "Looking up Pokemon data",
  search_pokemon: "Searching for Pokemon",
  get_moves_by_criteria: "Looking up moves",
  get_abilities: "Looking up abilities",
  compare_pokemon: "Comparing Pokemon",
  get_type_matchups: "Checking type matchups",
  get_smogon_sets: "Fetching Smogon sets",

  // analysis tools
  analyze_team_coverage: "Analyzing team coverage",
  find_team_weaknesses: "Finding team weaknesses",
  get_speed_tiers: "Checking speed tiers",
  calculate_damage: "Calculating damage",
  suggest_counters: "Finding counters",
  get_common_cores: "Looking up common cores",

  // team-crud tools
  create_team: "Creating team",
  get_team: "Loading team data",
  list_teams: "Listing teams",
  add_pokemon_to_team: "Adding Pokemon to team",
  update_pokemon_set: "Updating Pokemon set",
  remove_pokemon_from_team: "Removing Pokemon from team",

  // meta-recs tools
  get_meta_trends: "Checking meta trends",
  get_format_viability: "Checking format viability",
  get_usage_stats: "Fetching usage stats",
  suggest_teammates: "Finding teammate suggestions",
  suggest_sets: "Suggesting sets",
}

// Validate at module load that every tool in TOOL_CATEGORIES has a label
if (process.env.NODE_ENV !== "production") {
  for (const name of ALL_TOOL_NAMES) {
    if (!(name in TOOL_LABEL_MAP)) {
      console.warn(`[tool-labels] Missing label for tool "${name}" — add it to TOOL_LABEL_MAP`)
    }
  }
}

/** Write tools that mutate data — these get action notifications in the UI */
const WRITE_TOOL_NAMES = new Set([
  "create_team",
  "add_pokemon_to_team",
  "update_pokemon_set",
  "remove_pokemon_from_team",
])

/**
 * Get a human-readable label for a tool name.
 * Accepts both raw names and MCP-prefixed names.
 */
export function getToolLabel(name: string): string {
  const stripped = name.startsWith(MCP_PREFIX) ? name.slice(MCP_PREFIX.length) : name
  return TOOL_LABEL_MAP[stripped] ?? `Running ${stripped}`
}

/**
 * Check if a tool is a write/mutating tool that should trigger action notifications.
 */
export function isWriteTool(name: string): boolean {
  const stripped = name.startsWith(MCP_PREFIX) ? name.slice(MCP_PREFIX.length) : name
  return WRITE_TOOL_NAMES.has(stripped)
}
