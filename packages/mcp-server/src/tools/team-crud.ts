import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client.js";

export function registerTeamCrudTools(server: McpServer) {
  server.tool(
    "create_team",
    "Create a new Pokemon team for a competitive format",
    {
      name: z.string().describe("Team name"),
      formatId: z
        .string()
        .describe("Format ID (e.g., 'gen9ou', 'gen9vgc2024')"),
      mode: z
        .enum(["freeform", "guided"])
        .optional()
        .describe("Builder mode (default 'freeform')"),
      notes: z.string().optional().describe("Optional team notes"),
    },
    async ({ name, formatId, mode, notes }) => {
      try {
        const data = await apiPost("/teams", {
          name,
          formatId,
          mode: mode ?? "freeform",
          notes,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create team. Check that format "${formatId}" exists.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_team",
    "Get full details of a team including all Pokemon slots with their sets",
    {
      teamId: z.string().describe("Team UUID"),
    },
    async ({ teamId }) => {
      try {
        const data = await apiGet(`/teams/${encodeURIComponent(teamId)}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Team "${teamId}" not found.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_teams",
    "List all saved teams, optionally filtered by format",
    {
      formatId: z.string().optional().describe("Filter by format ID"),
    },
    async ({ formatId }) => {
      try {
        const params: Record<string, string> = {};
        if (formatId) params.formatId = formatId;
        const data = await apiGet("/teams", params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: "Failed to list teams." },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "add_pokemon_to_team",
    "Add a Pokemon to a team slot with its competitive set (ability, item, nature, moves, EVs)",
    {
      teamId: z.string().describe("Team UUID"),
      position: z.number().describe("Slot position (1-6)"),
      pokemonId: z
        .string()
        .describe("Pokemon ID (e.g., 'greatTusk')"),
      ability: z
        .string()
        .describe("Ability name (e.g., 'Protosynthesis')"),
      item: z
        .string()
        .describe("Held item (e.g., 'Booster Energy')"),
      nature: z
        .string()
        .describe("Nature (e.g., 'Jolly', 'Timid')"),
      teraType: z
        .string()
        .optional()
        .describe("Tera type (e.g., 'Ground', 'Steel')"),
      level: z.number().optional().describe("Level (default 100)"),
      moves: z
        .array(z.string())
        .describe("Array of 1-4 move names"),
      evs: z
        .object({
          hp: z.number().optional(),
          atk: z.number().optional(),
          def: z.number().optional(),
          spa: z.number().optional(),
          spd: z.number().optional(),
          spe: z.number().optional(),
        })
        .optional()
        .describe("EV spread"),
    },
    async ({
      teamId,
      position,
      pokemonId,
      ability,
      item,
      nature,
      teraType,
      level,
      moves,
      evs,
    }) => {
      try {
        const data = await apiPost(
          `/teams/${encodeURIComponent(teamId)}/slots`,
          {
            position,
            pokemonId,
            ability,
            item,
            nature,
            teraType,
            level: level ?? 100,
            moves,
            evs: {
              hp: evs?.hp ?? 0,
              atk: evs?.atk ?? 0,
              def: evs?.def ?? 0,
              spa: evs?.spa ?? 0,
              spd: evs?.spd ?? 0,
              spe: evs?.spe ?? 0,
            },
            ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
          }
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to add Pokemon to slot ${position}: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "remove_pokemon_from_team",
    "Remove a Pokemon from a team slot",
    {
      teamId: z.string().describe("Team UUID"),
      position: z.number().describe("Slot position to remove (1-6)"),
    },
    async ({ teamId, position }) => {
      try {
        const data = await apiDelete(
          `/teams/${encodeURIComponent(teamId)}/slots/${position}`
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to remove Pokemon from slot ${position}.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_pokemon_set",
    "Update a Pokemon's set in a team slot (change moves, EVs, item, etc.)",
    {
      teamId: z.string().describe("Team UUID"),
      position: z.number().describe("Slot position (1-6)"),
      ability: z.string().optional().describe("New ability"),
      item: z.string().optional().describe("New held item"),
      nature: z.string().optional().describe("New nature"),
      teraType: z.string().optional().describe("New Tera type"),
      moves: z
        .array(z.string())
        .optional()
        .describe("New move list"),
      evs: z
        .object({
          hp: z.number().optional(),
          atk: z.number().optional(),
          def: z.number().optional(),
          spa: z.number().optional(),
          spd: z.number().optional(),
          spe: z.number().optional(),
        })
        .optional()
        .describe("New EV spread"),
    },
    async ({ teamId, position, ...updates }) => {
      try {
        const data = await apiPut(
          `/teams/${encodeURIComponent(teamId)}/slots/${position}`,
          updates
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update slot ${position}.`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
