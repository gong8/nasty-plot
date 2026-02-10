import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../api-client.js";

export function registerDataQueryTools(server: McpServer) {
  server.tool(
    "get_pokemon",
    "Get detailed information about a Pokemon including stats, types, abilities, and tier",
    {
      pokemonId: z
        .string()
        .describe("Pokemon ID or name (e.g., 'greatTusk' or 'Great Tusk')"),
    },
    async ({ pokemonId }) => {
      try {
        const data = await apiGet(`/pokemon/${encodeURIComponent(pokemonId)}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not find Pokemon "${pokemonId}". Check the spelling or try a different name. Common formats: "greatTusk", "flutterMane", "ironValiant".`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "search_pokemon",
    "Search for Pokemon by name, returning matching results with basic info",
    {
      query: z.string().describe("Search query (partial name match)"),
      limit: z
        .number()
        .optional()
        .describe("Max results to return (default 10)"),
    },
    async ({ query, limit }) => {
      try {
        const params: Record<string, string> = { search: query };
        if (limit) params.limit = limit.toString();
        const data = await apiGet("/pokemon", params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Search failed for "${query}". Try a simpler query.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_usage_stats",
    "Get usage statistics for a competitive format showing the most popular Pokemon and their usage percentages",
    {
      formatId: z
        .string()
        .describe("Format ID (e.g., 'gen9ou', 'gen9uu', 'gen9vgc2024')"),
      limit: z
        .number()
        .optional()
        .describe("Number of results (default 20)"),
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
              text: `Could not fetch usage stats for format "${formatId}". Valid formats include: gen9ou, gen9uu, gen9uber, gen9vgc2024.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_smogon_sets",
    "Get recommended Smogon competitive sets for a Pokemon in a given format",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
      formatId: z
        .string()
        .optional()
        .describe("Format ID to filter sets (e.g., 'gen9ou')"),
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
              text: `Could not fetch sets for "${pokemonId}". The Pokemon may not have Smogon sets available.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_type_matchups",
    "Get type effectiveness matchups for a Pokemon's types (weaknesses, resistances, immunities)",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
    },
    async ({ pokemonId }) => {
      try {
        const data = (await apiGet(
          `/pokemon/${encodeURIComponent(pokemonId)}`
        )) as { data: { types: string[] } };
        const types = data?.data?.types ?? [];
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  pokemonId,
                  types,
                  note: "Use the type chart resource for full matchup details.",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Could not fetch type data for "${pokemonId}".` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_moves_by_criteria",
    "Get moves a Pokemon can learn, optionally filtered by type or category",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
      moveType: z
        .string()
        .optional()
        .describe("Filter by move type (e.g., 'Ground', 'Fire')"),
      category: z
        .string()
        .optional()
        .describe("Filter by category: 'Physical', 'Special', or 'Status'"),
    },
    async ({ pokemonId, moveType, category }) => {
      try {
        const params: Record<string, string> = {};
        if (moveType) params.type = moveType;
        if (category) params.category = category;
        const data = await apiGet(
          `/pokemon/${encodeURIComponent(pokemonId)}/learnset`,
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
              text: `Could not fetch learnset for "${pokemonId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_abilities",
    "Get information about a Pokemon's available abilities and their effects",
    {
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
    },
    async ({ pokemonId }) => {
      try {
        const data = (await apiGet(
          `/pokemon/${encodeURIComponent(pokemonId)}`
        )) as { data: { abilities: Record<string, string> } };
        const abilities = data?.data?.abilities ?? {};
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ pokemonId, abilities }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not fetch abilities for "${pokemonId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
