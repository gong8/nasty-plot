import { getDisallowedMcpTools, getPageTypeFromPath } from "../tool-context";
import type { PageType } from "../tool-context";

const MCP_PREFIX = "mcp__nasty-plot__";

describe("getPageTypeFromPath", () => {
  it('returns "team-editor" for team detail paths', () => {
    expect(getPageTypeFromPath("/teams/abc-123")).toBe("team-editor");
    expect(getPageTypeFromPath("/teams/my-team")).toBe("team-editor");
  });

  it('does not return "team-editor" for /teams root', () => {
    expect(getPageTypeFromPath("/teams")).not.toBe("team-editor");
  });

  it('does not return "team-editor" for nested team paths', () => {
    expect(getPageTypeFromPath("/teams/abc/edit")).not.toBe("team-editor");
  });

  it('returns "pokemon-detail" for pokemon detail paths', () => {
    expect(getPageTypeFromPath("/pokemon/pikachu")).toBe("pokemon-detail");
    expect(getPageTypeFromPath("/pokemon/great-tusk")).toBe("pokemon-detail");
  });

  it('does not return "pokemon-detail" for /pokemon root', () => {
    expect(getPageTypeFromPath("/pokemon")).not.toBe("pokemon-detail");
  });

  it('returns "pokemon-browser" for /pokemon', () => {
    expect(getPageTypeFromPath("/pokemon")).toBe("pokemon-browser");
  });

  it('returns "damage-calc" for /damage-calc', () => {
    expect(getPageTypeFromPath("/damage-calc")).toBe("damage-calc");
  });

  it('returns "battle-live" for /battle/live', () => {
    expect(getPageTypeFromPath("/battle/live")).toBe("battle-live");
  });

  it('returns "chat" for /chat', () => {
    expect(getPageTypeFromPath("/chat")).toBe("chat");
  });

  it('returns "home" for /', () => {
    expect(getPageTypeFromPath("/")).toBe("home");
  });

  it('returns "other" for unknown paths', () => {
    expect(getPageTypeFromPath("/settings")).toBe("other");
    expect(getPageTypeFromPath("/about")).toBe("other");
    expect(getPageTypeFromPath("/battle")).toBe("other");
    expect(getPageTypeFromPath("/battle/new")).toBe("other");
  });
});

describe("getDisallowedMcpTools", () => {
  it("returns empty array for pages with all categories allowed", () => {
    const result = getDisallowedMcpTools("team-editor");
    expect(result).toEqual([]);
  });

  it("returns empty array for chat page (all categories allowed)", () => {
    const result = getDisallowedMcpTools("chat");
    expect(result).toEqual([]);
  });

  it("returns empty array for home page (all categories allowed)", () => {
    const result = getDisallowedMcpTools("home");
    expect(result).toEqual([]);
  });

  it("returns empty array for other page (all categories allowed)", () => {
    const result = getDisallowedMcpTools("other");
    expect(result).toEqual([]);
  });

  it("disallows teamCrud and metaRecs for pokemon-detail", () => {
    const result = getDisallowedMcpTools("pokemon-detail");

    // pokemon-detail allows: dataQuery, analysis
    // So teamCrud and metaRecs should be disallowed
    const teamCrudTools = [
      "create_team",
      "get_team",
      "list_teams",
      "add_pokemon_to_team",
      "update_pokemon_set",
      "remove_pokemon_from_team",
    ];
    const metaRecsTools = [
      "get_meta_trends",
      "get_format_viability",
      "get_usage_stats",
      "suggest_teammates",
      "suggest_sets",
    ];

    for (const tool of teamCrudTools) {
      expect(result).toContain(`${MCP_PREFIX}${tool}`);
    }
    for (const tool of metaRecsTools) {
      expect(result).toContain(`${MCP_PREFIX}${tool}`);
    }
  });

  it("does not disallow dataQuery or analysis tools for pokemon-detail", () => {
    const result = getDisallowedMcpTools("pokemon-detail");
    const dataQueryTools = [
      "get_pokemon",
      "search_pokemon",
      "get_moves_by_criteria",
      "get_abilities",
      "compare_pokemon",
      "get_type_matchups",
      "get_smogon_sets",
    ];

    for (const tool of dataQueryTools) {
      expect(result).not.toContain(`${MCP_PREFIX}${tool}`);
    }
  });

  it("disallows teamCrud and analysis for pokemon-browser", () => {
    const result = getDisallowedMcpTools("pokemon-browser");

    // pokemon-browser allows: dataQuery, metaRecs
    // So teamCrud and analysis should be disallowed
    expect(result).toContain(`${MCP_PREFIX}create_team`);
    expect(result).toContain(`${MCP_PREFIX}analyze_team_coverage`);
    expect(result).not.toContain(`${MCP_PREFIX}get_pokemon`);
    expect(result).not.toContain(`${MCP_PREFIX}get_usage_stats`);
  });

  it("disallows teamCrud and metaRecs for damage-calc", () => {
    const result = getDisallowedMcpTools("damage-calc");

    // damage-calc allows: dataQuery, analysis
    expect(result).toContain(`${MCP_PREFIX}create_team`);
    expect(result).toContain(`${MCP_PREFIX}suggest_sets`);
    expect(result).not.toContain(`${MCP_PREFIX}get_pokemon`);
    expect(result).not.toContain(`${MCP_PREFIX}calculate_damage`);
  });

  it("disallows teamCrud and metaRecs for battle-live", () => {
    const result = getDisallowedMcpTools("battle-live");

    // battle-live allows: dataQuery, analysis
    expect(result).toContain(`${MCP_PREFIX}create_team`);
    expect(result).toContain(`${MCP_PREFIX}suggest_teammates`);
    expect(result).not.toContain(`${MCP_PREFIX}search_pokemon`);
    expect(result).not.toContain(`${MCP_PREFIX}find_team_weaknesses`);
  });

  it("returns all disallowed tools with MCP prefix", () => {
    const result = getDisallowedMcpTools("pokemon-detail");
    for (const tool of result) {
      expect(tool).toMatch(/^mcp__nasty-plot__/);
    }
  });
});
