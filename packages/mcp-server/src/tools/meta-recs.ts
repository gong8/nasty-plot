import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { apiGet, apiPost } from "../api-client.js"
import { buildParams, handleTool } from "../tool-helpers.js"

export function registerMetaRecsTools(server: McpServer): void {
  server.tool(
    "get_meta_trends",
    "Get current metagame trends for a format including top Pokemon and usage shifts",
    {
      formatId: z.string().describe("Format ID (e.g., 'gen9ou')"),
      limit: z.number().optional().describe("Number of top Pokemon to return (default 20)"),
    },
    ({ formatId, limit }) =>
      handleTool(
        () => apiGet(`/formats/${encodeURIComponent(formatId)}/usage`, buildParams({ limit })),
        `Could not fetch meta trends for "${formatId}".`,
      ),
  )

  server.tool(
    "get_format_viability",
    "Get the viability rankings for a format - a larger set of Pokemon sorted by competitive viability",
    {
      formatId: z.string().describe("Format ID"),
    },
    ({ formatId }) =>
      handleTool(
        () => apiGet(`/formats/${encodeURIComponent(formatId)}/usage`, { limit: "50" }),
        `Could not fetch viability for "${formatId}".`,
      ),
  )

  server.tool(
    "suggest_teammates",
    "Suggest Pokemon teammates that synergize well with the current team based on usage data and type coverage",
    {
      teamId: z.string().describe("Team UUID"),
      formatId: z.string().describe("Format ID for meta context"),
    },
    ({ teamId, formatId }) =>
      handleTool(
        () => apiPost("/recommend", { teamId, formatId }),
        `Could not suggest teammates. Make sure team "${teamId}" exists.`,
      ),
  )

  server.tool(
    "get_common_cores",
    "Get common Pokemon cores (pairs/trios that are frequently used together) in a format",
    {
      formatId: z.string().describe("Format ID"),
      pokemonId: z.string().optional().describe("Optional: find cores containing this Pokemon"),
    },
    ({ formatId, pokemonId }) =>
      handleTool(async () => {
        const data = await apiGet(`/formats/${encodeURIComponent(formatId)}/usage`, { limit: "30" })
        if (!pokemonId) return data
        return {
          note: `Showing usage data for ${formatId}. Filter for cores containing ${pokemonId}.`,
          data,
        }
      }, `Could not fetch cores for "${formatId}".`),
  )

  server.tool(
    "suggest_sets",
    "Get suggested competitive sets for a Pokemon, including Smogon recommended sets. Requires a format ID.",
    {
      pokemonId: z.string().describe("Pokemon ID"),
      formatId: z.string().describe("Format ID (required, e.g., 'gen9ou')"),
    },
    ({ pokemonId, formatId }) =>
      handleTool(
        () =>
          apiGet(
            `/pokemon/${encodeURIComponent(pokemonId)}/sets`,
            buildParams({ format: formatId }),
          ),
        `Could not fetch Smogon sets for "${pokemonId}". The Pokemon exists but set data may be unavailable for this format. Use get_pokemon for basic data instead.`,
      ),
  )
}
