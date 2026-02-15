import { streamChat } from "@nasty-plot/llm"
import { asMock } from "../test-utils"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStreamCliChat = vi.fn()
const mockGetTeam = vi.fn()
const mockGetUsageStats = vi.fn()

vi.mock("#llm/cli-chat.service", () => ({
  streamCliChat: (...args: unknown[]) => mockStreamCliChat(...args),
}))

vi.mock("#llm/tool-context", () => ({
  TOOL_CATEGORIES: {
    dataQuery: ["get_pokemon"],
    analysis: ["analyze_team_coverage"],
    teamCrud: ["create_team"],
    metaRecs: ["get_usage_stats"],
  },
  getDisallowedMcpTools: vi.fn().mockReturnValue([]),
  getDisallowedMcpToolsForContextMode: vi.fn().mockReturnValue([]),
  getAllMcpToolNames: vi.fn().mockReturnValue([]),
  getPageTypeFromPath: vi.fn().mockReturnValue("other"),
}))

vi.mock("@nasty-plot/teams", () => ({
  getTeam: (...args: unknown[]) => mockGetTeam(...args),
}))

vi.mock("@nasty-plot/smogon-data", () => ({
  getUsageStats: (...args: unknown[]) => mockGetUsageStats(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStream(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data))
      controller.close()
    },
  })
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const parts: string[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(decoder.decode(value))
  }

  return parts.join("")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("streamChat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStreamCliChat.mockReturnValue(makeStream('data: {"type":"content","content":"Hello"}\n\n'))
    mockGetTeam.mockResolvedValue(null)
    mockGetUsageStats.mockResolvedValue([])
  })

  it("returns a readable stream", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    })

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it("passes messages and system prompt to streamCliChat", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Help with my team" }],
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Help with my team" }],
        systemPrompt: expect.stringContaining("competitive Pokemon"),
      }),
    )
  })

  it("passes model to streamCliChat", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
      }),
    )
  })

  it("passes abort signal to streamCliChat", async () => {
    const controller = new AbortController()

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      signal: controller.signal,
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      }),
    )
  })

  it("fetches team context when teamId is provided", async () => {
    mockGetTeam.mockResolvedValue({
      id: "team-1",
      name: "Test",
      formatId: "gen9ou",
      mode: "freeform",
      slots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-1",
    })
    await collectStream(stream)

    expect(mockGetTeam).toHaveBeenCalledWith("team-1")
  })

  it("includes team data in system prompt", async () => {
    mockGetTeam.mockResolvedValue({
      id: "team-1",
      name: "My OU Team",
      formatId: "gen9ou",
      mode: "freeform",
      slots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-1",
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("My OU Team"),
      }),
    )
  })

  it("fetches meta context when formatId is provided", async () => {
    mockGetUsageStats.mockResolvedValue([])

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      formatId: "gen9ou",
    })
    await collectStream(stream)

    expect(mockGetUsageStats).toHaveBeenCalledWith("gen9ou", { limit: 20 })
  })

  it("includes page context in system prompt when provided", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      context: {
        pageType: "team-editor",
        contextSummary: "Editing team with 3 Pokemon",
      },
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Editing team with 3 Pokemon"),
      }),
    )
  })

  it("includes plan mode instructions in system prompt", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Planning"),
      }),
    )
  })

  it("handles team fetch failure gracefully", async () => {
    mockGetTeam.mockResolvedValue(null)

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "bad-team",
    })

    // Should not throw — team context is optional
    expect(stream).toBeInstanceOf(ReadableStream)
    await collectStream(stream)
  })

  it("handles team fetch network error gracefully", async () => {
    mockGetTeam.mockRejectedValue(new Error("Network error"))

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-1",
    })

    expect(stream).toBeInstanceOf(ReadableStream)
    await collectStream(stream)
  })

  it("passes disallowed MCP tools when page context has pageType", async () => {
    const { getDisallowedMcpTools } = await import("#llm/tool-context")
    asMock(getDisallowedMcpTools).mockReturnValue(["mcp__nasty-plot__create_team"])

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      context: {
        pageType: "pokemon-detail",
        contextSummary: "Viewing Pikachu",
      },
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        disallowedMcpTools: ["mcp__nasty-plot__create_team"],
      }),
    )
  })

  it("includes meta context when formatId has usage data", async () => {
    mockGetUsageStats.mockResolvedValue([
      { pokemonId: "garchomp", pokemonName: "Garchomp", usagePercent: 25.5, rank: 1 },
    ])

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      formatId: "gen9ou",
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Meta Overview: gen9ou"),
      }),
    )
  })

  it("handles usage stats fetch failure gracefully", async () => {
    mockGetUsageStats.mockRejectedValue(new Error("DB error"))

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      formatId: "gen9ou",
    })

    expect(stream).toBeInstanceOf(ReadableStream)
    await collectStream(stream)
  })

  it("extracts teamId and formatId from contextData when contextMode is set", async () => {
    const contextData = JSON.stringify({ teamId: "team-ctx", formatId: "gen9uu" })

    mockGetTeam.mockResolvedValue({
      id: "team-ctx",
      name: "Context Team",
      formatId: "gen9uu",
      mode: "freeform",
      slots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextMode: "guided-builder",
      contextData,
    })
    await collectStream(stream)

    expect(mockGetTeam).toHaveBeenCalledWith("team-ctx")
    expect(mockGetUsageStats).toHaveBeenCalledWith("gen9uu", { limit: 20 })
  })

  it("extracts teamId/formatId from contextData without contextMode when not already set", async () => {
    const contextData = JSON.stringify({ teamId: "team-fallback", formatId: "gen9ru" })

    mockGetTeam.mockResolvedValue(null)

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextData,
    })
    await collectStream(stream)

    expect(mockGetTeam).toHaveBeenCalledWith("team-fallback")
    expect(mockGetUsageStats).toHaveBeenCalledWith("gen9ru", { limit: 20 })
  })

  it("does not override existing teamId/formatId from contextData without contextMode", async () => {
    const contextData = JSON.stringify({ teamId: "team-override", formatId: "gen9uu" })

    mockGetTeam.mockResolvedValue(null)

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-original",
      formatId: "gen9ou",
      contextData,
    })
    await collectStream(stream)

    // Should use original values since they were already provided
    expect(mockGetTeam).toHaveBeenCalledWith("team-original")
    expect(mockGetUsageStats).toHaveBeenCalledWith("gen9ou", { limit: 20 })
  })

  it("handles invalid JSON contextData gracefully with contextMode", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextMode: "guided-builder",
      contextData: "not-json",
    })
    await collectStream(stream)

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it("handles invalid JSON contextData gracefully without contextMode", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextData: "not-json",
    })
    await collectStream(stream)

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it("includes context mode prompt when contextMode is set", async () => {
    const { getDisallowedMcpToolsForContextMode } = await import("#llm/tool-context")
    asMock(getDisallowedMcpToolsForContextMode).mockReturnValue([])

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextMode: "battle-live",
      contextData: JSON.stringify({ formatId: "gen9ou" }),
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("real-time battle coach"),
      }),
    )
  })

  it("uses context mode tool filtering instead of page-based when contextMode is set", async () => {
    const { getDisallowedMcpToolsForContextMode } = await import("#llm/tool-context")
    asMock(getDisallowedMcpToolsForContextMode).mockReturnValue(["mcp__nasty-plot__create_team"])

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextMode: "battle-live",
      context: {
        pageType: "team-editor",
        contextSummary: "Live battle",
      },
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        disallowedMcpTools: ["mcp__nasty-plot__create_team"],
      }),
    )
  })

  it("includes guided-builder live context when contextMode is guided-builder", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextMode: "guided-builder",
      contextData: JSON.stringify({ teamId: "t1", formatId: "gen9ou" }),
      context: {
        pageType: "guided-builder",
        contextSummary: "",
        guidedBuilder: {
          step: "build",
          teamSize: 2,
          currentBuildSlot: 3,
          slotSummaries: ["Garchomp", "Heatran"],
          formatId: "gen9ou",
        },
      },
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Guided Team Builder"),
      }),
    )
  })

  it("includes live state summary for non-guided context modes", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      contextMode: "battle-replay",
      contextData: JSON.stringify({ formatId: "gen9ou" }),
      context: {
        pageType: "battle-replay",
        contextSummary: "Reviewing battle replay",
      },
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Live State"),
      }),
    )
  })

  it("disables all tools when disableAllTools is true", async () => {
    const { getAllMcpToolNames } = await import("#llm/tool-context")
    asMock(getAllMcpToolNames).mockReturnValue([
      "mcp__nasty-plot__get_pokemon",
      "mcp__nasty-plot__create_team",
    ])

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      disableAllTools: true,
    })
    await collectStream(stream)

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        disallowedMcpTools: ["mcp__nasty-plot__get_pokemon", "mcp__nasty-plot__create_team"],
      }),
    )
  })
})
