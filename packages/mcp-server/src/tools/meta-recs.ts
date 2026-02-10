import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, apiPost } from "../api-client.js";

export function registerMetaRecsTools(server: McpServer) {
  server.tool(
    "get_meta_trends",
    "Get current metagame trends for a format including top Pokemon and usage shifts",
    {
      formatId: z
        .string()
        .describe("Format ID (e.g., 'gen9ou')"),
      limit: z
        .number()
        .optional()
        .describe("Number of top Pokemon to return (default 20)"),
    },
    async ({ formatId, limit }) => {
      try {
        const params: Record<string, string> = {};
        if (limit) params.limit = limit.toString();
        const data = await apiGet(
          `/formats/${encodeURIComponent(formatId)}/usage`,
          params
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not fetch meta trends for "${formatId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_format_viability",
    "Get the viability rankings for a format - a larger set of Pokemon sorted by competitive viability",
    {
      formatId: z.string().describe("Format ID"),
    },
    async ({ formatId }) => {
      try {
        const data = await apiGet(
          `/formats/${encodeURIComponent(formatId)}/usage`,
          { limit: "50" }
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not fetch viability for "${formatId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "suggest_teammates",
    "Suggest Pokemon teammates that synergize well with the current team based on usage data and type coverage",
    {
      teamId: z.string().describe("Team UUID"),
      formatId: z.string().describe("Format ID for meta context"),
    },
    async ({ teamId, formatId }) => {
      try {
        const data = await apiPost("/recommend", {
          teamId,
          formatId,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not suggest teammates. Make sure team "${teamId}" exists.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_common_cores",
    "Get common Pokemon cores (pairs/trios that are frequently used together) in a format",
    {
      formatId: z.string().describe("Format ID"),
      pokemonId: z
        .string()
        .optional()
        .describe("Optional: find cores containing this Pokemon"),
    },
    async ({ formatId, pokemonId }) => {
      try {
        // Usage data often includes teammate correlation info
        const params: Record<string, string> = { limit: "30" };
        const data = await apiGet(
          `/formats/${encodeURIComponent(formatId)}/usage`,
          params
        );
        // If a pokemonId filter was provided, note it in the response
        const result = pokemonId
          ? {
              note: `Showing usage data for ${formatId}. Filter for cores containing ${pokemonId}.`,
              data,
            }
          : data;
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not fetch cores for "${formatId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "suggest_sets",
    "Get suggested competitive sets for a Pokemon, including Smogon recommended sets",
    {
      pokemonId: z.string().describe("Pokemon ID"),
      formatId: z
        .string()
        .optional()
        .describe("Format context for set selection"),
    },
    async ({ pokemonId, formatId }) => {
      try {
        const params: Record<string, string> = {};
        if (formatId) params.format = formatId;
        const data = await apiGet(
          `/pokemon/${encodeURIComponent(pokemonId)}/sets`,
          params
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not fetch sets for "${pokemonId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
