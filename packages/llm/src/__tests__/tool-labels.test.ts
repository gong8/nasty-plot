import { getToolLabel, isWriteTool } from "../tool-labels";

const MCP_PREFIX = "mcp__nasty-plot__";

describe("getToolLabel", () => {
  it("returns label for known raw tool name", () => {
    expect(getToolLabel("get_pokemon")).toBe("Looking up Pokemon data");
  });

  it("returns label for known MCP-prefixed tool name", () => {
    expect(getToolLabel(`${MCP_PREFIX}get_pokemon`)).toBe(
      "Looking up Pokemon data"
    );
  });

  it("returns label for search_pokemon", () => {
    expect(getToolLabel("search_pokemon")).toBe("Searching for Pokemon");
  });

  it("returns label for get_moves_by_criteria", () => {
    expect(getToolLabel("get_moves_by_criteria")).toBe("Looking up moves");
  });

  it("returns label for get_abilities", () => {
    expect(getToolLabel("get_abilities")).toBe("Looking up abilities");
  });

  it("returns label for compare_pokemon", () => {
    expect(getToolLabel("compare_pokemon")).toBe("Comparing Pokemon");
  });

  it("returns label for get_type_matchups", () => {
    expect(getToolLabel("get_type_matchups")).toBe("Checking type matchups");
  });

  it("returns label for get_smogon_sets", () => {
    expect(getToolLabel("get_smogon_sets")).toBe("Fetching Smogon sets");
  });

  it("returns label for analysis tools", () => {
    expect(getToolLabel("analyze_team_coverage")).toBe(
      "Analyzing team coverage"
    );
    expect(getToolLabel("find_team_weaknesses")).toBe(
      "Finding team weaknesses"
    );
    expect(getToolLabel("get_speed_tiers")).toBe("Checking speed tiers");
    expect(getToolLabel("calculate_damage")).toBe("Calculating damage");
    expect(getToolLabel("suggest_counters")).toBe("Finding counters");
    expect(getToolLabel("get_common_cores")).toBe("Looking up common cores");
  });

  it("returns label for team-crud tools", () => {
    expect(getToolLabel("create_team")).toBe("Creating team");
    expect(getToolLabel("get_team")).toBe("Loading team data");
    expect(getToolLabel("list_teams")).toBe("Listing teams");
    expect(getToolLabel("add_pokemon_to_team")).toBe(
      "Adding Pokemon to team"
    );
    expect(getToolLabel("update_pokemon_set")).toBe("Updating Pokemon set");
    expect(getToolLabel("remove_pokemon_from_team")).toBe(
      "Removing Pokemon from team"
    );
  });

  it("returns label for meta-recs tools", () => {
    expect(getToolLabel("get_meta_trends")).toBe("Checking meta trends");
    expect(getToolLabel("get_format_viability")).toBe(
      "Checking format viability"
    );
    expect(getToolLabel("get_usage_stats")).toBe("Fetching usage stats");
    expect(getToolLabel("suggest_teammates")).toBe(
      "Finding teammate suggestions"
    );
    expect(getToolLabel("suggest_sets")).toBe("Suggesting sets");
  });

  it("returns fallback label for unknown tool name", () => {
    expect(getToolLabel("unknown_tool")).toBe("Running unknown_tool");
  });

  it("strips MCP prefix before fallback", () => {
    expect(getToolLabel(`${MCP_PREFIX}unknown_tool`)).toBe(
      "Running unknown_tool"
    );
  });
});

describe("isWriteTool", () => {
  it("returns true for create_team", () => {
    expect(isWriteTool("create_team")).toBe(true);
  });

  it("returns true for add_pokemon_to_team", () => {
    expect(isWriteTool("add_pokemon_to_team")).toBe(true);
  });

  it("returns true for update_pokemon_set", () => {
    expect(isWriteTool("update_pokemon_set")).toBe(true);
  });

  it("returns true for remove_pokemon_from_team", () => {
    expect(isWriteTool("remove_pokemon_from_team")).toBe(true);
  });

  it("returns true for MCP-prefixed write tools", () => {
    expect(isWriteTool(`${MCP_PREFIX}create_team`)).toBe(true);
    expect(isWriteTool(`${MCP_PREFIX}add_pokemon_to_team`)).toBe(true);
    expect(isWriteTool(`${MCP_PREFIX}update_pokemon_set`)).toBe(true);
    expect(isWriteTool(`${MCP_PREFIX}remove_pokemon_from_team`)).toBe(true);
  });

  it("returns false for read-only tools", () => {
    expect(isWriteTool("get_pokemon")).toBe(false);
    expect(isWriteTool("search_pokemon")).toBe(false);
    expect(isWriteTool("get_team")).toBe(false);
    expect(isWriteTool("list_teams")).toBe(false);
    expect(isWriteTool("calculate_damage")).toBe(false);
    expect(isWriteTool("get_usage_stats")).toBe(false);
  });

  it("returns false for unknown tools", () => {
    expect(isWriteTool("unknown_tool")).toBe(false);
  });

  it("returns false for MCP-prefixed read-only tools", () => {
    expect(isWriteTool(`${MCP_PREFIX}get_pokemon`)).toBe(false);
    expect(isWriteTool(`${MCP_PREFIX}list_teams`)).toBe(false);
  });
});
