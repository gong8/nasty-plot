import { registerDataQueryTools } from "#mcp-server/tools/data-query"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("#mcp-server/api-client", () => ({
  apiGet: vi.fn(),
}))

vi.mock("#mcp-server/tool-helpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("#mcp-server/tool-helpers")>()
  return {
    ...original,
    handleTool: original.handleTool,
    buildParams: original.buildParams,
    toolSuccess: original.toolSuccess,
    toolError: original.toolError,
  }
})

import { apiGet } from "#mcp-server/api-client"
const mockApiGet = vi.mocked(apiGet)

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

describe("registerDataQueryTools", () => {
  let tools: Map<string, ToolHandler>

  beforeEach(() => {
    vi.resetAllMocks()
    const mock = createMockServer()
    tools = mock.tools
    registerDataQueryTools(mock.server as never)
  })

  it("registers exactly 7 tools", () => {
    expect(tools.size).toBe(7)
  })

  it("registers all expected tool names", () => {
    const names = [...tools.keys()]
    expect(names).toContain("get_pokemon")
    expect(names).toContain("search_pokemon")
    expect(names).toContain("get_usage_stats")
    expect(names).toContain("get_smogon_sets")
    expect(names).toContain("get_type_matchups")
    expect(names).toContain("get_moves_by_criteria")
    expect(names).toContain("get_abilities")
  })

  // -------------------------------------------------------------------------
  // get_pokemon
  // -------------------------------------------------------------------------

  describe("get_pokemon", () => {
    it("calls apiGet with the pokemon path", async () => {
      mockApiGet.mockResolvedValue({ data: { name: "Great Tusk" } })

      const handler = tools.get("get_pokemon")!
      const result = await handler({ pokemonId: "greatTusk" })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/greatTusk")
      expect(result).not.toHaveProperty("isError")
    })

    it("encodes special characters in pokemonId", async () => {
      mockApiGet.mockResolvedValue({})
      const handler = tools.get("get_pokemon")!
      await handler({ pokemonId: "mr. mime" })
      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/mr.%20mime")
    })

    it("returns toolError on API failure", async () => {
      mockApiGet.mockRejectedValue(new Error("API error 404"))
      const handler = tools.get("get_pokemon")!
      const result = (await handler({ pokemonId: "fakemon" })) as {
        isError: boolean
        content: Array<{ text: string }>
      }
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("fakemon")
    })
  })

  // -------------------------------------------------------------------------
  // search_pokemon
  // -------------------------------------------------------------------------

  describe("search_pokemon", () => {
    it("calls apiGet with search params", async () => {
      mockApiGet.mockResolvedValue({ data: [] })

      const handler = tools.get("search_pokemon")!
      await handler({ query: "char", limit: 5 })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon", {
        search: "char",
        limit: "5",
      })
    })

    it("omits limit when undefined", async () => {
      mockApiGet.mockResolvedValue({ data: [] })

      const handler = tools.get("search_pokemon")!
      await handler({ query: "pika" })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon", { search: "pika" })
    })
  })

  // -------------------------------------------------------------------------
  // get_usage_stats
  // -------------------------------------------------------------------------

  describe("get_usage_stats", () => {
    it("calls apiGet with format usage path", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_usage_stats")!
      await handler({ formatId: "gen9ou", limit: 10 })

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9ou/usage", {
        limit: "10",
      })
    })

    it("omits limit when not provided", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_usage_stats")!
      await handler({ formatId: "gen9uu" })

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9uu/usage", {})
    })
  })

  // -------------------------------------------------------------------------
  // get_smogon_sets
  // -------------------------------------------------------------------------

  describe("get_smogon_sets", () => {
    it("calls apiGet with pokemon sets path and format param", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_smogon_sets")!
      await handler({ pokemonId: "greatTusk", formatId: "gen9ou" })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/greatTusk/sets", {
        formatId: "gen9ou",
      })
    })

    it("omits format when not provided", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_smogon_sets")!
      await handler({ pokemonId: "pikachu" })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/pikachu/sets", {})
    })
  })

  // -------------------------------------------------------------------------
  // get_type_matchups
  // -------------------------------------------------------------------------

  describe("get_type_matchups", () => {
    it("fetches pokemon data and returns types with pokemonId", async () => {
      mockApiGet.mockResolvedValue({
        data: { types: ["Ground", "Fighting"] },
      })

      const handler = tools.get("get_type_matchups")!
      const result = (await handler({ pokemonId: "greatTusk" })) as {
        content: Array<{ text: string }>
      }

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/greatTusk")
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.pokemonId).toBe("greatTusk")
      expect(parsed.types).toEqual(["Ground", "Fighting"])
    })

    it("returns empty types array when data is missing", async () => {
      mockApiGet.mockResolvedValue({ data: {} })

      const handler = tools.get("get_type_matchups")!
      const result = (await handler({ pokemonId: "unknown" })) as {
        content: Array<{ text: string }>
      }

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.types).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // get_moves_by_criteria
  // -------------------------------------------------------------------------

  describe("get_moves_by_criteria", () => {
    it("calls apiGet with learnset path and filters", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_moves_by_criteria")!
      await handler({
        pokemonId: "greatTusk",
        moveType: "Ground",
        category: "Physical",
      })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/greatTusk/learnset", {
        type: "Ground",
        category: "Physical",
      })
    })

    it("omits undefined filters", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_moves_by_criteria")!
      await handler({ pokemonId: "pikachu" })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/pikachu/learnset", {})
    })
  })

  // -------------------------------------------------------------------------
  // get_abilities
  // -------------------------------------------------------------------------

  describe("get_abilities", () => {
    it("fetches pokemon data and extracts abilities", async () => {
      mockApiGet.mockResolvedValue({
        data: {
          abilities: { "0": "Protosynthesis", H: "Sand Veil" },
        },
      })

      const handler = tools.get("get_abilities")!
      const result = (await handler({ pokemonId: "greatTusk" })) as {
        content: Array<{ text: string }>
      }

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.pokemonId).toBe("greatTusk")
      expect(parsed.abilities).toEqual({
        "0": "Protosynthesis",
        H: "Sand Veil",
      })
    })

    it("returns empty abilities when data is missing", async () => {
      mockApiGet.mockResolvedValue({ data: {} })

      const handler = tools.get("get_abilities")!
      const result = (await handler({ pokemonId: "unknown" })) as {
        content: Array<{ text: string }>
      }

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.abilities).toEqual({})
    })
  })
})
