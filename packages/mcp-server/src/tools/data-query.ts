import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { apiGet } from "../api-client.js"
import { buildParams, handleTool } from "../tool-helpers.js"

export function registerDataQueryTools(server: McpServer): void {
  server.tool(
    "get_pokemon",
    "Get detailed information about a Pokemon including stats, types, abilities, and tier",
    {
      pokemonId: z.string().describe("Pokemon ID or name (e.g., 'greatTusk' or 'Great Tusk')"),
    },
    ({ pokemonId }) =>
      handleTool(
        () => apiGet(`/pokemon/${encodeURIComponent(pokemonId)}`),
        `Failed to look up Pokemon "${pokemonId}". This may be a server error — the Pokemon likely exists. Try again or use search_pokemon instead.`,
      ),
  )

  server.tool(
    "search_pokemon",
    "Search for Pokemon by name, returning matching results with basic info",
    {
      query: z.string().describe("Search query (partial name match)"),
      limit: z.number().optional().describe("Max results to return (default 10)"),
    },
    ({ query, limit }) =>
      handleTool(
        () => apiGet("/pokemon", buildParams({ search: query, limit })),
        `Search failed for "${query}". Try a simpler query.`,
      ),
  )

  server.tool(
    "get_usage_stats",
    "Get usage statistics for a competitive format showing the most popular Pokemon and their usage percentages",
    {
      formatId: z.string().describe("Format ID (e.g., 'gen9ou', 'gen9uu', 'gen9vgc2024')"),
      limit: z.number().optional().describe("Number of results (default 20)"),
    },
    ({ formatId, limit }) =>
      handleTool(
        () => apiGet(`/formats/${encodeURIComponent(formatId)}/usage`, buildParams({ limit })),
        `Could not fetch usage stats for format "${formatId}". Valid formats include: gen9ou, gen9uu, gen9uber, gen9vgc2024.`,
      ),
  )

  server.tool(
    "get_smogon_sets",
    "Get recommended Smogon competitive sets for a Pokemon in a given format",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
      formatId: z.string().optional().describe("Format ID to filter sets (e.g., 'gen9ou')"),
    },
    ({ pokemonId, formatId }) =>
      handleTool(
        () =>
          apiGet(
            `/pokemon/${encodeURIComponent(pokemonId)}/sets`,
            buildParams({ format: formatId }),
          ),
        `Could not fetch sets for "${pokemonId}". The Pokemon may not have Smogon sets available.`,
      ),
  )

  server.tool(
    "get_type_matchups",
    "Get type effectiveness matchups for a Pokemon's types (weaknesses, resistances, immunities)",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
    },
    ({ pokemonId }) =>
      handleTool(async () => {
        const data = (await apiGet(`/pokemon/${encodeURIComponent(pokemonId)}`)) as {
          data: { types: string[] }
        }
        return {
          pokemonId,
          types: data?.data?.types ?? [],
          note: "Use the type chart resource for full matchup details.",
        }
      }, `Could not fetch type data for "${pokemonId}".`),
  )

  server.tool(
    "get_moves_by_criteria",
    "Get moves a Pokemon can learn, optionally filtered by type or category",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
      moveType: z.string().optional().describe("Filter by move type (e.g., 'Ground', 'Fire')"),
      category: z
        .string()
        .optional()
        .describe("Filter by category: 'Physical', 'Special', or 'Status'"),
    },
    ({ pokemonId, moveType, category }) =>
      handleTool(
        () =>
          apiGet(
            `/pokemon/${encodeURIComponent(pokemonId)}/learnset`,
            buildParams({ type: moveType, category }),
          ),
        `Could not fetch learnset for "${pokemonId}".`,
      ),
  )

  server.tool(
    "get_abilities",
    "Get information about a Pokemon's available abilities and their effects",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
    },
    ({ pokemonId }) =>
      handleTool(async () => {
        const data = (await apiGet(`/pokemon/${encodeURIComponent(pokemonId)}`)) as {
          data: { abilities: Record<string, string> }
        }
        return { pokemonId, abilities: data?.data?.abilities ?? {} }
      }, `Could not fetch abilities for "${pokemonId}".`),
  )
}
