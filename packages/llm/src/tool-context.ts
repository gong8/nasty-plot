const MCP_PREFIX = "mcp__nasty-plot__";

/** Tool categories mapped to their MCP tool names (without prefix) */
const TOOL_CATEGORIES: Record<string, string[]> = {
  dataQuery: [
    "get_pokemon",
    "search_pokemon",
    "get_moves_by_criteria",
    "get_abilities",
    "compare_pokemon",
    "get_type_matchups",
    "get_smogon_sets",
  ],
  analysis: [
    "analyze_team_coverage",
    "find_team_weaknesses",
    "get_speed_tiers",
    "calculate_damage",
    "suggest_counters",
    "get_common_cores",
  ],
  teamCrud: [
    "create_team",
    "get_team",
    "list_teams",
    "add_pokemon_to_team",
    "update_pokemon_set",
    "remove_pokemon_from_team",
  ],
  metaRecs: [
    "get_meta_trends",
    "get_format_viability",
    "get_usage_stats",
    "suggest_teammates",
    "suggest_sets",
  ],
};

/** All MCP tool names (with prefix) */
const ALL_MCP_TOOLS = Object.values(TOOL_CATEGORIES)
  .flat()
  .map((name) => `${MCP_PREFIX}${name}`);

export type PageType =
  | "team-editor"
  | "pokemon-detail"
  | "pokemon-browser"
  | "damage-calc"
  | "battle-live"
  | "chat"
  | "home"
  | "other";

/** Map page types to which tool categories are ALLOWED */
const TOOL_CONTEXT_MAP: Record<PageType, string[]> = {
  "team-editor": ["dataQuery", "analysis", "teamCrud", "metaRecs"],
  "pokemon-detail": ["dataQuery", "analysis"],
  "pokemon-browser": ["dataQuery", "metaRecs"],
  "damage-calc": ["dataQuery", "analysis"],
  "battle-live": ["dataQuery", "analysis"],
  chat: ["dataQuery", "analysis", "teamCrud", "metaRecs"],
  home: ["dataQuery", "analysis", "teamCrud", "metaRecs"],
  other: ["dataQuery", "analysis", "teamCrud", "metaRecs"],
};

/**
 * Get MCP tool names that should be disallowed for a given page type.
 * Returns full MCP-prefixed tool names.
 */
export function getDisallowedMcpTools(pageType: PageType): string[] {
  const allowedCategories = TOOL_CONTEXT_MAP[pageType];
  const allowedTools = new Set(
    allowedCategories.flatMap(
      (cat) => TOOL_CATEGORIES[cat]?.map((name) => `${MCP_PREFIX}${name}`) ?? []
    )
  );

  return ALL_MCP_TOOLS.filter((tool) => !allowedTools.has(tool));
}

/**
 * Determine the page type from a pathname.
 */
export function getPageTypeFromPath(pathname: string): PageType {
  if (pathname.match(/^\/teams\/[^/]+$/)) return "team-editor";
  if (pathname.match(/^\/pokemon\/[^/]+$/)) return "pokemon-detail";
  if (pathname === "/pokemon") return "pokemon-browser";
  if (pathname === "/damage-calc") return "damage-calc";
  if (pathname === "/battle/live") return "battle-live";
  if (pathname === "/chat") return "chat";
  if (pathname === "/") return "home";
  return "other";
}
