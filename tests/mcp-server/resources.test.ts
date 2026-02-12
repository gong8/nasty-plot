import { registerResources } from "#mcp-server/resources/index"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("#mcp-server/api-client", () => ({
  apiGet: vi.fn(),
}))

import { apiGet } from "#mcp-server/api-client"
const mockApiGet = vi.mocked(apiGet)

// ---------------------------------------------------------------------------
// Helper: mock McpServer
// ---------------------------------------------------------------------------

function createMockServer() {
  const resourceCalls: Array<{
    name: string
    uriOrTemplate: unknown
    handler: (...args: unknown[]) => Promise<unknown>
  }> = []

  const server = {
    resource: vi.fn((...args: unknown[]) => {
      resourceCalls.push({
        name: args[0] as string,
        uriOrTemplate: args[1],
        handler: args[args.length - 1] as (...a: unknown[]) => Promise<unknown>,
      })
    }),
  }

  return { server, resourceCalls }
}

function getResourceHandler(
  resourceCalls: ReturnType<typeof createMockServer>["resourceCalls"],
  name: string,
) {
  const entry = resourceCalls.find((r) => r.name === name)
  if (!entry) throw new Error(`Resource "${name}" not registered`)
  return entry.handler
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerResources", () => {
  let server: ReturnType<typeof createMockServer>["server"]
  let resourceCalls: ReturnType<typeof createMockServer>["resourceCalls"]

  beforeEach(() => {
    vi.resetAllMocks()
    const mock = createMockServer()
    server = mock.server
    resourceCalls = mock.resourceCalls
    registerResources(server as never)
  })

  it("registers exactly 5 resources", () => {
    expect(server.resource).toHaveBeenCalledTimes(5)
  })

  it("registers type-chart resource", () => {
    const names = resourceCalls.map((r) => r.name)
    expect(names).toContain("type-chart")
  })

  it("registers formats-list resource", () => {
    const names = resourceCalls.map((r) => r.name)
    expect(names).toContain("formats-list")
  })

  it("registers natures resource", () => {
    const names = resourceCalls.map((r) => r.name)
    expect(names).toContain("natures")
  })

  it("registers stat-formulas resource", () => {
    const names = resourceCalls.map((r) => r.name)
    expect(names).toContain("stat-formulas")
  })

  it("registers viability resource", () => {
    const names = resourceCalls.map((r) => r.name)
    expect(names).toContain("viability")
  })

  // -------------------------------------------------------------------------
  // Static resource handlers
  // -------------------------------------------------------------------------

  describe("type-chart handler", () => {
    it("returns type chart data as JSON resource", async () => {
      const handler = getResourceHandler(resourceCalls, "type-chart")
      const result = (await handler()) as {
        contents: Array<{ uri: string; text: string; mimeType: string }>
      }
      expect(result.contents).toHaveLength(1)
      expect(result.contents[0].uri).toBe("pokemon://type-chart")
      expect(result.contents[0].mimeType).toBe("application/json")
      const data = JSON.parse(result.contents[0].text)
      expect(data).toHaveProperty("Fire")
      expect(data.Fire).toHaveProperty("Grass", 2)
      expect(data.Fire).toHaveProperty("Water", 0.5)
    })
  })

  describe("formats-list handler", () => {
    it("returns formats list", async () => {
      const handler = getResourceHandler(resourceCalls, "formats-list")
      const result = (await handler()) as {
        contents: Array<{ uri: string; text: string; mimeType: string }>
      }
      expect(result.contents[0].uri).toBe("pokemon://formats")
      const data = JSON.parse(result.contents[0].text)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
      expect(data[0]).toHaveProperty("id")
      expect(data[0]).toHaveProperty("name")
    })
  })

  describe("natures handler", () => {
    it("returns natures data with stat modifiers", async () => {
      const handler = getResourceHandler(resourceCalls, "natures")
      const result = (await handler()) as {
        contents: Array<{ uri: string; text: string; mimeType: string }>
      }
      expect(result.contents[0].uri).toBe("pokemon://natures")
      const data = JSON.parse(result.contents[0].text)
      expect(data).toHaveProperty("Adamant")
      expect(data.Adamant).toEqual({ plus: "atk", minus: "spa" })
      expect(data).toHaveProperty("Hardy")
      expect(data.Hardy).toEqual({})
    })
  })

  describe("stat-formulas handler", () => {
    it("returns stat formulas as markdown text", async () => {
      const handler = getResourceHandler(resourceCalls, "stat-formulas")
      const result = (await handler()) as {
        contents: Array<{ uri: string; text: string; mimeType: string }>
      }
      expect(result.contents[0].uri).toBe("pokemon://stat-formulas")
      expect(result.contents[0].mimeType).toBe("text/markdown")
      expect(result.contents[0].text).toContain("HP Formula")
      expect(result.contents[0].text).toContain("NatureMultiplier")
    })
  })

  // -------------------------------------------------------------------------
  // Viability resource (dynamic, uses apiGet)
  // -------------------------------------------------------------------------

  describe("viability handler", () => {
    it("calls apiGet with format usage endpoint", async () => {
      const usageData = [{ pokemonId: "greatTusk", usagePercent: 25 }]
      mockApiGet.mockResolvedValue(usageData)

      const handler = getResourceHandler(resourceCalls, "viability")
      const uri = new URL("pokemon://viability/gen9ou")
      const result = (await handler(uri, { formatId: "gen9ou" })) as {
        contents: Array<{ uri: string; text: string; mimeType: string }>
      }

      expect(mockApiGet).toHaveBeenCalledWith("/formats/gen9ou/usage", {
        limit: "50",
      })
      const data = JSON.parse(result.contents[0].text)
      expect(data).toEqual(usageData)
    })

    it("returns error object when apiGet fails", async () => {
      mockApiGet.mockRejectedValue(new Error("API error 500"))

      const handler = getResourceHandler(resourceCalls, "viability")
      const uri = new URL("pokemon://viability/gen9fake")
      const result = (await handler(uri, { formatId: "gen9fake" })) as {
        contents: Array<{ uri: string; text: string; mimeType: string }>
      }

      const data = JSON.parse(result.contents[0].text)
      expect(data).toHaveProperty("error")
      expect(data.error).toContain("gen9fake")
    })

    it("viability resource is registered with a ResourceTemplate", () => {
      const entry = resourceCalls.find((r) => r.name === "viability")
      expect(entry).toBeDefined()
      // The second arg is a ResourceTemplate instance (not a plain string URI)
      expect(entry!.uriOrTemplate).toBeDefined()
      expect(typeof entry!.uriOrTemplate).toBe("object")
    })
  })
})
