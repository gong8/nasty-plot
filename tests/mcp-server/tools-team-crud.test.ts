import { registerTeamCrudTools } from "#mcp-server/tools/team-crud"
import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL, MAX_SINGLE_EV } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("#mcp-server/api-client.service", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}))

import { apiGet, apiPost, apiPut, apiDelete } from "#mcp-server/api-client.service"
const mockApiGet = vi.mocked(apiGet)
const mockApiPost = vi.mocked(apiPost)
const mockApiPut = vi.mocked(apiPut)
const mockApiDelete = vi.mocked(apiDelete)

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

describe("registerTeamCrudTools", () => {
  let tools: Map<string, ToolHandler>

  beforeEach(() => {
    vi.resetAllMocks()
    const mock = createMockServer()
    tools = mock.tools
    registerTeamCrudTools(mock.server as never)
  })

  it("registers exactly 6 tools", () => {
    expect(tools.size).toBe(6)
  })

  it("registers all expected tool names", () => {
    const names = [...tools.keys()]
    expect(names).toContain("create_team")
    expect(names).toContain("get_team")
    expect(names).toContain("list_teams")
    expect(names).toContain("add_pokemon_to_team")
    expect(names).toContain("remove_pokemon_from_team")
    expect(names).toContain("update_pokemon_set")
  })

  // -------------------------------------------------------------------------
  // create_team
  // -------------------------------------------------------------------------

  describe("create_team", () => {
    it("posts team creation with default mode", async () => {
      mockApiPost.mockResolvedValue({ id: "uuid-1" })

      const handler = tools.get("create_team")!
      await handler({ name: "My Team", formatId: "gen9ou" })

      expect(mockApiPost).toHaveBeenCalledWith("/teams", {
        name: "My Team",
        formatId: "gen9ou",
        mode: "freeform",
        notes: undefined,
      })
    })

    it("passes custom mode and notes", async () => {
      mockApiPost.mockResolvedValue({ id: "uuid-2" })

      const handler = tools.get("create_team")!
      await handler({
        name: "Guided Team",
        formatId: "gen9uu",
        mode: "guided",
        notes: "testing",
      })

      expect(mockApiPost).toHaveBeenCalledWith("/teams", {
        name: "Guided Team",
        formatId: "gen9uu",
        mode: "guided",
        notes: "testing",
      })
    })

    it("returns error on failure", async () => {
      mockApiPost.mockRejectedValue(new Error("format not found"))

      const handler = tools.get("create_team")!
      const result = (await handler({
        name: "Bad",
        formatId: "gen9fake",
      })) as { isError: boolean; content: Array<{ text: string }> }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("gen9fake")
    })
  })

  // -------------------------------------------------------------------------
  // get_team
  // -------------------------------------------------------------------------

  describe("get_team", () => {
    it("calls apiGet with team path", async () => {
      mockApiGet.mockResolvedValue({ id: "team-1", name: "My Team" })

      const handler = tools.get("get_team")!
      const result = (await handler({ teamId: "team-1" })) as {
        content: Array<{ text: string }>
      }

      expect(mockApiGet).toHaveBeenCalledWith("/teams/team-1")
      expect(result).not.toHaveProperty("isError")
    })

    it("returns error when team not found", async () => {
      mockApiGet.mockRejectedValue(new Error("404"))

      const handler = tools.get("get_team")!
      const result = (await handler({ teamId: "bad" })) as {
        isError: boolean
        content: Array<{ text: string }>
      }

      expect(result.isError).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // list_teams
  // -------------------------------------------------------------------------

  describe("list_teams", () => {
    it("calls apiGet with format filter", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("list_teams")!
      await handler({ formatId: "gen9ou" })

      expect(mockApiGet).toHaveBeenCalledWith("/teams", {
        formatId: "gen9ou",
      })
    })

    it("calls apiGet without filter when formatId undefined", async () => {
      mockApiGet.mockResolvedValue([])

      const handler = tools.get("list_teams")!
      await handler({})

      expect(mockApiGet).toHaveBeenCalledWith("/teams", {})
    })
  })

  // -------------------------------------------------------------------------
  // add_pokemon_to_team
  // -------------------------------------------------------------------------

  describe("add_pokemon_to_team", () => {
    it("posts slot creation with full details", async () => {
      mockApiPost.mockResolvedValue({ ok: true })

      const handler = tools.get("add_pokemon_to_team")!
      const result = (await handler({
        teamId: "team-1",
        position: 1,
        pokemonId: "greatTusk",
        ability: "Protosynthesis",
        item: "Booster Energy",
        nature: "Jolly",
        teraType: "Ground",
        level: DEFAULT_LEVEL,
        moves: ["Headlong Rush", "Close Combat", "Knock Off", "Rapid Spin"],
        evs: { hp: 0, atk: MAX_SINGLE_EV, def: 0, spa: 0, spd: 4, spe: MAX_SINGLE_EV },
      })) as { content: Array<{ text: string }> }

      expect(mockApiPost).toHaveBeenCalledWith("/teams/team-1/slots", {
        position: 1,
        pokemonId: "greatTusk",
        ability: "Protosynthesis",
        item: "Booster Energy",
        nature: "Jolly",
        teraType: "Ground",
        level: DEFAULT_LEVEL,
        moves: ["Headlong Rush", "Close Combat", "Knock Off", "Rapid Spin"],
        evs: { hp: 0, atk: MAX_SINGLE_EV, def: 0, spa: 0, spd: 4, spe: MAX_SINGLE_EV },
        ivs: DEFAULT_IVS,
      })
      expect(result).not.toHaveProperty("isError")
    })

    it("uses default level 100 and zero EVs when not provided", async () => {
      mockApiPost.mockResolvedValue({ ok: true })

      const handler = tools.get("add_pokemon_to_team")!
      await handler({
        teamId: "team-1",
        position: 2,
        pokemonId: "pikachu",
        ability: "Static",
        item: "Light Ball",
        nature: "Timid",
        moves: ["Thunderbolt"],
      })

      expect(mockApiPost).toHaveBeenCalledWith("/teams/team-1/slots", {
        position: 2,
        pokemonId: "pikachu",
        ability: "Static",
        item: "Light Ball",
        nature: "Timid",
        teraType: undefined,
        level: DEFAULT_LEVEL,
        moves: ["Thunderbolt"],
        evs: DEFAULT_EVS,
        ivs: DEFAULT_IVS,
      })
    })

    it("merges partial EVs with zero defaults", async () => {
      mockApiPost.mockResolvedValue({ ok: true })

      const handler = tools.get("add_pokemon_to_team")!
      await handler({
        teamId: "team-1",
        position: 3,
        pokemonId: "charizard",
        ability: "Blaze",
        item: "Choice Specs",
        nature: "Timid",
        moves: ["Fire Blast"],
        evs: { spa: MAX_SINGLE_EV, spe: MAX_SINGLE_EV },
      })

      const body = mockApiPost.mock.calls[0][1] as { evs: Record<string, number> }
      expect(body.evs).toEqual({
        hp: 0,
        atk: 0,
        def: 0,
        spa: MAX_SINGLE_EV,
        spd: 0,
        spe: MAX_SINGLE_EV,
      })
    })

    it("returns toolError on failure with Error object", async () => {
      mockApiPost.mockRejectedValue(new Error("Slot occupied"))

      const handler = tools.get("add_pokemon_to_team")!
      const result = (await handler({
        teamId: "team-1",
        position: 1,
        pokemonId: "pikachu",
        ability: "Static",
        item: "Light Ball",
        nature: "Timid",
        moves: ["Thunderbolt"],
      })) as { isError: boolean; content: Array<{ text: string }> }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("slot 1")
      expect(result.content[0].text).toContain("Slot occupied")
    })

    it("returns toolError with 'Unknown error' for non-Error throws", async () => {
      mockApiPost.mockRejectedValue("string error")

      const handler = tools.get("add_pokemon_to_team")!
      const result = (await handler({
        teamId: "team-1",
        position: 2,
        pokemonId: "pikachu",
        ability: "Static",
        item: "Light Ball",
        nature: "Timid",
        moves: ["Thunderbolt"],
      })) as { isError: boolean; content: Array<{ text: string }> }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("slot 2")
      expect(result.content[0].text).toContain("Unknown error")
    })
  })

  // -------------------------------------------------------------------------
  // remove_pokemon_from_team
  // -------------------------------------------------------------------------

  describe("remove_pokemon_from_team", () => {
    it("calls apiDelete with correct path", async () => {
      mockApiDelete.mockResolvedValue({ deleted: true })

      const handler = tools.get("remove_pokemon_from_team")!
      await handler({ teamId: "team-1", position: 3 })

      expect(mockApiDelete).toHaveBeenCalledWith("/teams/team-1/slots/3")
    })

    it("returns error on failure", async () => {
      mockApiDelete.mockRejectedValue(new Error("not found"))

      const handler = tools.get("remove_pokemon_from_team")!
      const result = (await handler({ teamId: "t1", position: 5 })) as {
        isError: boolean
        content: Array<{ text: string }>
      }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("slot 5")
    })
  })

  // -------------------------------------------------------------------------
  // update_pokemon_set
  // -------------------------------------------------------------------------

  describe("update_pokemon_set", () => {
    it("calls apiPut with update fields", async () => {
      mockApiPut.mockResolvedValue({ ok: true })

      const handler = tools.get("update_pokemon_set")!
      await handler({
        teamId: "team-1",
        position: 1,
        ability: "Sand Veil",
        item: "Choice Band",
      })

      expect(mockApiPut).toHaveBeenCalledWith("/teams/team-1/slots/1", {
        ability: "Sand Veil",
        item: "Choice Band",
      })
    })

    it("passes moves and EVs through", async () => {
      mockApiPut.mockResolvedValue({ ok: true })

      const handler = tools.get("update_pokemon_set")!
      await handler({
        teamId: "team-1",
        position: 2,
        moves: ["Surf", "Ice Beam"],
        evs: { spa: MAX_SINGLE_EV },
      })

      expect(mockApiPut).toHaveBeenCalledWith("/teams/team-1/slots/2", {
        moves: ["Surf", "Ice Beam"],
        evs: { spa: MAX_SINGLE_EV },
      })
    })

    it("returns error on failure", async () => {
      mockApiPut.mockRejectedValue(new Error("invalid nature"))

      const handler = tools.get("update_pokemon_set")!
      const result = (await handler({
        teamId: "t1",
        position: 4,
        nature: "InvalidNature",
      })) as { isError: boolean; content: Array<{ text: string }> }

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("slot 4")
    })
  })
})
