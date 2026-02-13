import { registerAnalysisTools } from "#mcp-server/tools/analysis"
import { DEFAULT_LEVEL } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("#mcp-server/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost } from "#mcp-server/api-client"
const mockApiGet = vi.mocked(apiGet)
const mockApiPost = vi.mocked(apiPost)

// ---------------------------------------------------------------------------
// Helper: mock McpServer and extract tool handlers
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

function createMockServer() {
  const tools = new Map<string, ToolHandler>()

  const server = {
    tool: vi.fn((...args: unknown[]) => {
      const name = args[0] as string
      const handler = args[args.length - 1] as ToolHandler
      tools.set(name, handler)
    }),
  }

  return { server, tools }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerAnalysisTools", () => {
  let tools: Map<string, ToolHandler>

  beforeEach(() => {
    vi.resetAllMocks()
    const mock = createMockServer()
    tools = mock.tools
    registerAnalysisTools(mock.server as never)
  })

  it("registers exactly 6 tools", () => {
    expect(tools.size).toBe(6)
  })

  it("registers all expected tool names", () => {
    const names = [...tools.keys()]
    expect(names).toContain("analyze_team_coverage")
    expect(names).toContain("find_team_weaknesses")
    expect(names).toContain("suggest_counters")
    expect(names).toContain("compare_pokemon")
    expect(names).toContain("calculate_damage")
    expect(names).toContain("get_speed_tiers")
  })

  // -------------------------------------------------------------------------
  // analyze_team_coverage
  // -------------------------------------------------------------------------

  describe("analyze_team_coverage", () => {
    it("returns coverage data from analysis API", async () => {
      const coverage = { offensiveCoverage: {}, defensiveCoverage: {} }
      mockApiGet.mockResolvedValue({ data: { coverage } })

      const handler = tools.get("analyze_team_coverage")!
      const result = (await handler({ teamId: "team-1" })) as {
        content: Array<{ text: string }>
      }

      expect(mockApiGet).toHaveBeenCalledWith("/teams/team-1/analysis")
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(coverage)
    })

    it("returns full data when coverage field is missing", async () => {
      const data = { data: { other: "stuff" } }
      mockApiGet.mockResolvedValue(data)

      const handler = tools.get("analyze_team_coverage")!
      const result = (await handler({ teamId: "t1" })) as {
        content: Array<{ text: string }>
      }

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(data)
    })

    it("returns error on API failure", async () => {
      mockApiGet.mockRejectedValue(new Error("not found"))

      const handler = tools.get("analyze_team_coverage")!
      const result = (await handler({ teamId: "bad" })) as {
        isError: boolean
        content: Array<{ text: string }>
      }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("bad")
    })
  })

  // -------------------------------------------------------------------------
  // find_team_weaknesses
  // -------------------------------------------------------------------------

  describe("find_team_weaknesses", () => {
    it("extracts shared weaknesses and threats", async () => {
      const weaknesses = ["Fire", "Water"]
      const threats = [{ id: "heatran" }]
      mockApiGet.mockResolvedValue({
        data: {
          coverage: { sharedWeaknesses: weaknesses },
          threats,
        },
      })

      const handler = tools.get("find_team_weaknesses")!
      const result = (await handler({ teamId: "team-1" })) as {
        content: Array<{ text: string }>
      }

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.sharedWeaknesses).toEqual(weaknesses)
      expect(parsed.threats).toEqual(threats)
    })

    it("returns empty arrays when data fields are missing", async () => {
      mockApiGet.mockResolvedValue({ data: {} })

      const handler = tools.get("find_team_weaknesses")!
      const result = (await handler({ teamId: "t1" })) as {
        content: Array<{ text: string }>
      }

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.sharedWeaknesses).toEqual([])
      expect(parsed.threats).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // suggest_counters
  // -------------------------------------------------------------------------

  describe("suggest_counters", () => {
    it("posts counter request with default format", async () => {
      mockApiPost.mockResolvedValue({ counters: [] })

      const handler = tools.get("suggest_counters")!
      await handler({ pokemonId: "greatTusk" })

      expect(mockApiPost).toHaveBeenCalledWith("/recommend", {
        targetPokemonId: "greatTusk",
        formatId: "gen9ou",
        type: "counters",
      })
    })

    it("uses provided formatId", async () => {
      mockApiPost.mockResolvedValue({ counters: [] })

      const handler = tools.get("suggest_counters")!
      await handler({ pokemonId: "pikachu", formatId: "gen9uu" })

      expect(mockApiPost).toHaveBeenCalledWith("/recommend", {
        targetPokemonId: "pikachu",
        formatId: "gen9uu",
        type: "counters",
      })
    })
  })

  // -------------------------------------------------------------------------
  // compare_pokemon
  // -------------------------------------------------------------------------

  describe("compare_pokemon", () => {
    it("fetches both pokemon and computes stat differences", async () => {
      const dataA = {
        data: {
          name: "Great Tusk",
          types: ["Ground", "Fighting"],
          baseStats: { hp: 115, atk: 131, def: 131, spa: 53, spd: 53, spe: 87 },
          abilities: {},
        },
      }
      const dataB = {
        data: {
          name: "Iron Valiant",
          types: ["Fairy", "Fighting"],
          baseStats: { hp: 74, atk: 130, def: 90, spa: 120, spd: 60, spe: 116 },
          abilities: {},
        },
      }

      mockApiGet.mockResolvedValueOnce(dataA).mockResolvedValueOnce(dataB)

      const handler = tools.get("compare_pokemon")!
      const result = (await handler({
        pokemonA: "greatTusk",
        pokemonB: "ironValiant",
      })) as { content: Array<{ text: string }> }

      expect(mockApiGet).toHaveBeenCalledTimes(2)
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.pokemonA.bst).toBe(115 + 131 + 131 + 53 + 53 + 87)
      expect(parsed.pokemonB.bst).toBe(74 + 130 + 90 + 120 + 60 + 116)
      expect(parsed.statDifferences.hp).toBe(115 - 74)
      expect(parsed.statDifferences.spe).toBe(87 - 116)
    })

    it("returns error when one pokemon fetch fails", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: { baseStats: {} } })
        .mockRejectedValueOnce(new Error("not found"))

      const handler = tools.get("compare_pokemon")!
      const result = (await handler({
        pokemonA: "pikachu",
        pokemonB: "fakemon",
      })) as { isError: boolean; content: Array<{ text: string }> }

      expect(result.isError).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // calculate_damage
  // -------------------------------------------------------------------------

  describe("calculate_damage", () => {
    it("posts damage calc request with default levels", async () => {
      mockApiPost.mockResolvedValue({ damage: [100, 120] })

      const handler = tools.get("calculate_damage")!
      await handler({
        attackerPokemon: "greatTusk",
        defenderPokemon: "ironValiant",
        moveName: "Headlong Rush",
      })

      expect(mockApiPost).toHaveBeenCalledWith("/damage-calc", {
        attacker: { pokemonId: "greatTusk", level: DEFAULT_LEVEL },
        defender: { pokemonId: "ironValiant", level: DEFAULT_LEVEL },
        move: "Headlong Rush",
      })
    })

    it("uses provided levels", async () => {
      mockApiPost.mockResolvedValue({})

      const handler = tools.get("calculate_damage")!
      await handler({
        attackerPokemon: "pikachu",
        defenderPokemon: "charizard",
        moveName: "Thunderbolt",
        attackerLevel: 50,
        defenderLevel: 75,
      })

      expect(mockApiPost).toHaveBeenCalledWith("/damage-calc", {
        attacker: { pokemonId: "pikachu", level: 50 },
        defender: { pokemonId: "charizard", level: 75 },
        move: "Thunderbolt",
      })
    })
  })

  // -------------------------------------------------------------------------
  // get_speed_tiers
  // -------------------------------------------------------------------------

  describe("get_speed_tiers", () => {
    it("extracts speed tiers from analysis data", async () => {
      const speedTiers = [
        { pokemonId: "greatTusk", speed: 287 },
        { pokemonId: "ironValiant", speed: 381 },
      ]
      mockApiGet.mockResolvedValue({ data: { speedTiers } })

      const handler = tools.get("get_speed_tiers")!
      const result = (await handler({ teamId: "team-1" })) as {
        content: Array<{ text: string }>
      }

      expect(mockApiGet).toHaveBeenCalledWith("/teams/team-1/analysis")
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(speedTiers)
    })

    it("returns empty array when speedTiers is missing", async () => {
      mockApiGet.mockResolvedValue({ data: {} })

      const handler = tools.get("get_speed_tiers")!
      const result = (await handler({ teamId: "t1" })) as {
        content: Array<{ text: string }>
      }

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual([])
    })
  })
})
