import { z } from "zod"
import { DEFAULT_LEVEL, type PokemonType, type StatName } from "@nasty-plot/core"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { apiGet, apiPost } from "../api-client.js"
import { handleTool } from "../tool-helpers.js"

export function registerAnalysisTools(server: McpServer): void {
  server.tool(
    "analyze_team_coverage",
    "Analyze a team's type coverage including offensive and defensive matchups, uncovered types, and shared weaknesses",
    {
      teamId: z.string().describe("Team UUID"),
    },
    ({ teamId }) =>
      handleTool(async () => {
        const data = (await apiGet(`/teams/${encodeURIComponent(teamId)}/analysis`)) as {
          data: { coverage: unknown }
        }
        return data?.data?.coverage ?? data
      }, `Could not analyze team "${teamId}". Make sure the team exists and has Pokemon.`),
  )

  server.tool(
    "find_team_weaknesses",
    "Identify a team's shared weaknesses and key threats from the metagame",
    {
      teamId: z.string().describe("Team UUID"),
    },
    ({ teamId }) =>
      handleTool(async () => {
        const data = (await apiGet(`/teams/${encodeURIComponent(teamId)}/analysis`)) as {
          data: {
            coverage?: { sharedWeaknesses: unknown }
            threats?: unknown
          }
        }
        return {
          sharedWeaknesses: data?.data?.coverage?.sharedWeaknesses ?? [],
          threats: data?.data?.threats ?? [],
        }
      }, `Could not find weaknesses for team "${teamId}".`),
  )

  server.tool(
    "suggest_counters",
    "Suggest Pokemon that counter the current team's threats. Uses the recommendation engine to find Pokemon with good matchups against common threats to the team.",
    {
      teamId: z.string().describe("Team UUID to find counters for"),
      limit: z.number().optional().describe("Number of suggestions to return (default 10)"),
    },
    ({ teamId, limit }) =>
      handleTool(
        () =>
          apiPost("/recommend", {
            teamId,
            limit: limit ?? 10,
          }),
        `Could not suggest counters for team "${teamId}". Make sure the team exists and has Pokemon.`,
      ),
  )

  server.tool(
    "compare_pokemon",
    "Compare two Pokemon side-by-side including stats, types, and competitive viability",
    {
      pokemonA: z.string().describe("First Pokemon ID"),
      pokemonB: z.string().describe("Second Pokemon ID"),
    },
    ({ pokemonA, pokemonB }) =>
      handleTool(async () => {
        const [dataA, dataB] = await Promise.all([
          apiGet(`/pokemon/${encodeURIComponent(pokemonA)}`),
          apiGet(`/pokemon/${encodeURIComponent(pokemonB)}`),
        ])

        const a = (dataA as { data: PokemonData }).data
        const b = (dataB as { data: PokemonData }).data
        const bstA = sumStats(a.baseStats)
        const bstB = sumStats(b.baseStats)

        return {
          pokemonA: { ...a, bst: bstA },
          pokemonB: { ...b, bst: bstB },
          statDifferences: Object.fromEntries(
            (Object.keys(a.baseStats) as StatName[]).map((stat) => [
              stat,
              a.baseStats[stat] - b.baseStats[stat],
            ]),
          ),
        }
      }, `Could not compare "${pokemonA}" and "${pokemonB}". Check that both names are correct.`),
  )

  server.tool(
    "calculate_damage",
    "Calculate damage from one Pokemon's move against another, including KO chance",
    {
      attackerPokemonId: z.string().describe("Attacking Pokemon ID"),
      defenderPokemonId: z.string().describe("Defending Pokemon ID"),
      moveName: z.string().describe("Move name (e.g., 'Earthquake')"),
      attackerLevel: z.number().optional().describe("Attacker level (default 100)"),
      defenderLevel: z.number().optional().describe("Defender level (default 100)"),
    },
    ({ attackerPokemonId, defenderPokemonId, moveName, attackerLevel, defenderLevel }) =>
      handleTool(
        () =>
          apiPost("/damage-calc", {
            attacker: {
              pokemonId: attackerPokemonId,
              level: attackerLevel ?? DEFAULT_LEVEL,
            },
            defender: {
              pokemonId: defenderPokemonId,
              level: defenderLevel ?? DEFAULT_LEVEL,
            },
            move: moveName,
          }),
        `Damage calculation failed. Check move name "${moveName}" and Pokemon IDs.`,
      ),
  )

  server.tool(
    "get_speed_tiers",
    "Get the speed tiers for a team showing each Pokemon's effective speed",
    {
      teamId: z.string().describe("Team UUID"),
    },
    ({ teamId }) =>
      handleTool(async () => {
        const data = (await apiGet(`/teams/${encodeURIComponent(teamId)}/analysis`)) as {
          data: { speedTiers: unknown }
        }
        return data?.data?.speedTiers ?? []
      }, `Could not fetch speed tiers for team "${teamId}".`),
  )
}

interface PokemonData {
  name: string
  types: PokemonType[]
  baseStats: Record<StatName, number>
  abilities: Record<string, string>
  tier?: string
}

function sumStats(stats: Record<StatName, number>): number {
  return Object.values(stats).reduce((sum, v) => sum + v, 0)
}
