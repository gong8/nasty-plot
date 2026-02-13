import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DEFAULT_IVS, DEFAULT_LEVEL, fillStats } from "@nasty-plot/core"
import { apiDelete, apiGet, apiPost, apiPut } from "../api-client.js"
import { buildParams, handleTool, toolError, toolSuccess } from "../tool-helpers.js"

const evsSchema = z
  .object({
    hp: z.number().optional(),
    atk: z.number().optional(),
    def: z.number().optional(),
    spa: z.number().optional(),
    spd: z.number().optional(),
    spe: z.number().optional(),
  })
  .optional()
  .describe("EV spread")

export function registerTeamCrudTools(server: McpServer): void {
  server.tool(
    "create_team",
    "Create a new Pokemon team for a competitive format",
    {
      name: z.string().describe("Team name"),
      formatId: z.string().describe("Format ID (e.g., 'gen9ou', 'gen9vgc2024')"),
      mode: z.enum(["freeform", "guided"]).optional().describe("Builder mode (default 'freeform')"),
      notes: z.string().optional().describe("Optional team notes"),
    },
    ({ name, formatId, mode, notes }) =>
      handleTool(
        () =>
          apiPost("/teams", {
            name,
            formatId,
            mode: mode ?? "freeform",
            notes,
          }),
        `Failed to create team. Check that format "${formatId}" exists.`,
      ),
  )

  server.tool(
    "get_team",
    "Get full details of a team including all Pokemon slots with their sets",
    {
      teamId: z.string().describe("Team UUID"),
    },
    ({ teamId }) =>
      handleTool(
        () => apiGet(`/teams/${encodeURIComponent(teamId)}`),
        `Team "${teamId}" not found.`,
      ),
  )

  server.tool(
    "list_teams",
    "List all saved teams, optionally filtered by format",
    {
      formatId: z.string().optional().describe("Filter by format ID"),
    },
    ({ formatId }) =>
      handleTool(() => apiGet("/teams", buildParams({ formatId })), "Failed to list teams."),
  )

  server.tool(
    "add_pokemon_to_team",
    "Add a Pokemon to a team slot with its competitive set (ability, item, nature, moves, EVs)",
    {
      teamId: z.string().describe("Team UUID"),
      position: z.number().describe("Slot position (1-6)"),
      pokemonId: z.string().describe("Pokemon ID (e.g., 'greatTusk')"),
      ability: z.string().describe("Ability name (e.g., 'Protosynthesis')"),
      item: z.string().describe("Held item (e.g., 'Booster Energy')"),
      nature: z.string().describe("Nature (e.g., 'Jolly', 'Timid')"),
      teraType: z.string().optional().describe("Tera type (e.g., 'Ground', 'Steel')"),
      level: z.number().optional().describe("Level (default 100)"),
      moves: z.array(z.string()).describe("Array of 1-4 move names"),
      evs: evsSchema,
    },
    async ({ teamId, position, pokemonId, ability, item, nature, teraType, level, moves, evs }) => {
      try {
        const data = await apiPost(`/teams/${encodeURIComponent(teamId)}/slots`, {
          position,
          pokemonId,
          ability,
          item,
          nature,
          teraType,
          level: level ?? DEFAULT_LEVEL,
          moves,
          evs: fillStats(evs, 0),
          ivs: DEFAULT_IVS,
        })
        return toolSuccess(data)
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        return toolError(`Failed to add Pokemon to slot ${position}: ${msg}`)
      }
    },
  )

  server.tool(
    "remove_pokemon_from_team",
    "Remove a Pokemon from a team slot",
    {
      teamId: z.string().describe("Team UUID"),
      position: z.number().describe("Slot position to remove (1-6)"),
    },
    ({ teamId, position }) =>
      handleTool(
        () => apiDelete(`/teams/${encodeURIComponent(teamId)}/slots/${position}`),
        `Failed to remove Pokemon from slot ${position}.`,
      ),
  )

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
      moves: z.array(z.string()).optional().describe("New move list"),
      evs: evsSchema,
    },
    ({ teamId, position, ...updates }) =>
      handleTool(
        () => apiPut(`/teams/${encodeURIComponent(teamId)}/slots/${position}`, updates),
        `Failed to update slot ${position}.`,
      ),
  )
}
