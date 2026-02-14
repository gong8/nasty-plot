import { registerMetaRecsTools } from "#mcp-server/tools/meta-recs"

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

describe("registerMetaRecsTools", () => {
  let tools: Map<string, ToolHandler>

  beforeEach(() => {
    vi.resetAllMocks()
    const mock = createMockServer()
    tools = mock.tools
    registerMetaRecsTools(mock.server as never)
  })

  it("registers exactly 5 tools", () => {
    expect(tools.size).toBe(5)
  })

  it("registers all expected tool names", () => {
    const names = [...tools.keys()]
    expect(names).toContain("get_meta_trends")
    expect(names).toContain("get_format_viability")
    expect(names).toContain("suggest_teammates")
    expect(names).toContain("get_common_cores")
    expect(names).toContain("suggest_sets")
  })

  // -------------------------------------------------------------------------
  // get_meta_trends
  // -------------------------------------------------------------------------

  describe("get_meta_trends", () => {
    it("calls apiGet with format usage path and limit", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_meta_trends")!
      await handler({ formatId: "gen9ou", limit: 10 })

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9ou/usage", {
        limit: "10",
      })
    })

    it("omits limit when not provided", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_meta_trends")!
      await handler({ formatId: "gen9uu" })

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9uu/usage", {})
    })

    it("returns error on failure", async () => {
      mockApiGet.mockRejectedValue(new Error("timeout"))

      const handler = tools.get("get_meta_trends")!
      const result = (await handler({ formatId: "gen9ou" })) as {
        isError: boolean
        content: Array<{ text: string }>
      }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("gen9ou")
    })
  })

  // -------------------------------------------------------------------------
  // get_format_viability
  // -------------------------------------------------------------------------

  describe("get_format_viability", () => {
    it("calls apiGet with limit 50", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("get_format_viability")!
      await handler({ formatId: "gen9ou" })

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9ou/usage", {
        limit: "50",
      })
    })

    it("returns error on failure", async () => {
      mockApiGet.mockRejectedValue(new Error("not found"))

      const handler = tools.get("get_format_viability")!
      const result = (await handler({ formatId: "gen9fake" })) as {
        isError: boolean
        content: Array<{ text: string }>
      }

      expect(result.isError).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // suggest_teammates
  // -------------------------------------------------------------------------

  describe("suggest_teammates", () => {
    it("posts recommendation request with teamId and formatId", async () => {
      mockApiPost.mockResolvedValue({ recommendations: [] })

      const handler = tools.get("suggest_teammates")!
      await handler({ teamId: "team-1", formatId: "gen9ou" })

      expect(mockApiPost).toHaveBeenCalledWith("/recommend", {
        teamId: "team-1",
        formatId: "gen9ou",
      })
    })

    it("returns error on failure", async () => {
      mockApiPost.mockRejectedValue(new Error("team not found"))

      const handler = tools.get("suggest_teammates")!
      const result = (await handler({
        teamId: "bad",
        formatId: "gen9ou",
      })) as { isError: boolean; content: Array<{ text: string }> }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("bad")
    })
  })

  // -------------------------------------------------------------------------
  // get_common_cores
  // -------------------------------------------------------------------------

  describe("get_common_cores", () => {
    it("calls apiGet with cores endpoint and no pokemonId filter", async () => {
      const coresData = [
        { pokemonAId: "greatTusk", pokemonBId: "ironValiant", correlationPercent: 15 },
      ]
      mockApiGet.mockResolvedValue(coresData)

      const handler = tools.get("get_common_cores")!
      const result = (await handler({ formatId: "gen9ou" })) as {
        content: Array<{ text: string }>
      }

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9ou/cores", {})
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(coresData)
    })

    it("passes pokemonId filter to cores endpoint", async () => {
      const coresData = [
        { pokemonAId: "greatTusk", pokemonBId: "ironValiant", correlationPercent: 15 },
      ]
      mockApiGet.mockResolvedValue(coresData)

      const handler = tools.get("get_common_cores")!
      const result = (await handler({
        formatId: "gen9ou",
        pokemonId: "greatTusk",
      })) as { content: Array<{ text: string }> }

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9ou/cores", {
        pokemonId: "greatTusk",
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(coresData)
    })

    it("returns error on failure", async () => {
      mockApiGet.mockRejectedValue(new Error("server error"))

      const handler = tools.get("get_common_cores")!
      const result = (await handler({ formatId: "gen9ou" })) as {
        isError: boolean
        content: Array<{ text: string }>
      }

      expect(result.isError).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // suggest_sets
  // -------------------------------------------------------------------------

  describe("suggest_sets", () => {
    it("calls apiGet with pokemon sets path and format param", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("suggest_sets")!
      await handler({ pokemonId: "greatTusk", formatId: "gen9ou" })

      expect(mockApiGet).toHaveBeenCalledWith("/pokemon/greatTusk/sets", {
        formatId: "gen9ou",
      })
    })

    it("returns error on failure", async () => {
      mockApiGet.mockRejectedValue(new Error("not found"))

      const handler = tools.get("suggest_sets")!
      const result = (await handler({
        pokemonId: "fakemon",
        formatId: "gen9ou",
      })) as { isError: boolean; content: Array<{ text: string }> }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("fakemon")
    })
  })
})
