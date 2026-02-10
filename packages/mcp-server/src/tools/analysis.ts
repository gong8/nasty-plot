import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, apiPost } from "../api-client.js";

export function registerAnalysisTools(server: McpServer) {
  server.tool(
    "analyze_team_coverage",
    "Analyze a team's type coverage including offensive and defensive matchups, uncovered types, and shared weaknesses",
    {
      teamId: z.string().describe("Team UUID"),
    },
    async ({ teamId }) => {
      try {
        const data = (await apiGet(
          `/teams/${encodeURIComponent(teamId)}/analysis`
        )) as { data: { coverage: unknown } };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data?.data?.coverage ?? data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not analyze team "${teamId}". Make sure the team exists and has Pokemon.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "find_team_weaknesses",
    "Identify a team's shared weaknesses and key threats from the metagame",
    {
      teamId: z.string().describe("Team UUID"),
    },
    async ({ teamId }) => {
      try {
        const data = (await apiGet(
          `/teams/${encodeURIComponent(teamId)}/analysis`
        )) as {
          data: {
            coverage?: { sharedWeaknesses: unknown };
            threats?: unknown;
          };
        };
        const result = {
          sharedWeaknesses: data?.data?.coverage?.sharedWeaknesses ?? [],
          threats: data?.data?.threats ?? [],
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not find weaknesses for team "${teamId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "suggest_counters",
    "Suggest counters or checks for a specific Pokemon or team threat",
    {
      pokemonId: z
        .string()
        .describe("The Pokemon to find counters for"),
      formatId: z
        .string()
        .optional()
        .describe("Format context (e.g., 'gen9ou')"),
    },
    async ({ pokemonId, formatId }) => {
      try {
        const data = await apiPost("/recommend", {
          targetPokemonId: pokemonId,
          formatId: formatId ?? "gen9ou",
          type: "counters",
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not suggest counters for "${pokemonId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "compare_pokemon",
    "Compare two Pokemon side-by-side including stats, types, and competitive viability",
    {
      pokemonA: z.string().describe("First Pokemon ID"),
      pokemonB: z.string().describe("Second Pokemon ID"),
    },
    async ({ pokemonA, pokemonB }) => {
      try {
        const [dataA, dataB] = await Promise.all([
          apiGet(`/pokemon/${encodeURIComponent(pokemonA)}`) as Promise<{
            data: {
              name: string;
              types: string[];
              baseStats: Record<string, number>;
              abilities: Record<string, string>;
              tier?: string;
            };
          }>,
          apiGet(`/pokemon/${encodeURIComponent(pokemonB)}`) as Promise<{
            data: {
              name: string;
              types: string[];
              baseStats: Record<string, number>;
              abilities: Record<string, string>;
              tier?: string;
            };
          }>,
        ]);

        const a = dataA.data;
        const b = dataB.data;
        const bstA = Object.values(a.baseStats).reduce(
          (sum: number, v: number) => sum + v,
          0
        );
        const bstB = Object.values(b.baseStats).reduce(
          (sum: number, v: number) => sum + v,
          0
        );

        const comparison = {
          pokemonA: {
            name: a.name,
            types: a.types,
            baseStats: a.baseStats,
            bst: bstA,
            abilities: a.abilities,
            tier: a.tier,
          },
          pokemonB: {
            name: b.name,
            types: b.types,
            baseStats: b.baseStats,
            bst: bstB,
            abilities: b.abilities,
            tier: b.tier,
          },
          statDifferences: Object.fromEntries(
            Object.keys(a.baseStats).map((stat) => [
              stat,
              a.baseStats[stat] - b.baseStats[stat],
            ])
          ),
        };

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(comparison, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not compare "${pokemonA}" and "${pokemonB}". Check that both names are correct.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "calculate_damage",
    "Calculate damage from one Pokemon's move against another, including KO chance",
    {
      attackerPokemon: z.string().describe("Attacking Pokemon ID"),
      defenderPokemon: z.string().describe("Defending Pokemon ID"),
      moveName: z.string().describe("Move name (e.g., 'Earthquake')"),
      attackerLevel: z
        .number()
        .optional()
        .describe("Attacker level (default 100)"),
      defenderLevel: z
        .number()
        .optional()
        .describe("Defender level (default 100)"),
    },
    async ({
      attackerPokemon,
      defenderPokemon,
      moveName,
      attackerLevel,
      defenderLevel,
    }) => {
      try {
        const data = await apiPost("/damage-calc", {
          attacker: {
            pokemonId: attackerPokemon,
            level: attackerLevel ?? 100,
          },
          defender: {
            pokemonId: defenderPokemon,
            level: defenderLevel ?? 100,
          },
          move: moveName,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Damage calculation failed. Check move name "${moveName}" and Pokemon IDs.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_speed_tiers",
    "Get the speed tiers for a team showing each Pokemon's effective speed",
    {
      teamId: z.string().describe("Team UUID"),
    },
    async ({ teamId }) => {
      try {
        const data = (await apiGet(
          `/teams/${encodeURIComponent(teamId)}/analysis`
        )) as { data: { speedTiers: unknown } };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data?.data?.speedTiers ?? [], null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not fetch speed tiers for team "${teamId}".`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
