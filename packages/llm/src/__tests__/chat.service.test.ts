import { streamChat } from "../chat.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStreamCliChat = vi.fn();

vi.mock("../cli-chat", () => ({
  streamCliChat: (...args: unknown[]) => mockStreamCliChat(...args),
}));

vi.mock("../tool-context", () => ({
  getDisallowedMcpTools: vi.fn().mockReturnValue([]),
  getPageTypeFromPath: vi.fn().mockReturnValue("other"),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStream(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

async function collectStream(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(decoder.decode(value));
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("streamChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockStreamCliChat.mockReturnValue(
      makeStream('data: {"type":"content","content":"Hello"}\n\n'),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a readable stream", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("passes messages and system prompt to streamCliChat", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Help with my team" }],
    });
    await collectStream(stream);

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Help with my team" }],
        systemPrompt: expect.stringContaining("competitive Pokemon"),
      }),
    );
  });

  it("passes model to streamCliChat", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });
    await collectStream(stream);

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
      }),
    );
  });

  it("passes abort signal to streamCliChat", async () => {
    const controller = new AbortController();

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      signal: controller.signal,
    });
    await collectStream(stream);

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it("fetches team context when teamId is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "team-1",
            name: "Test",
            formatId: "gen9ou",
            mode: "freeform",
            slots: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-1",
    });
    await collectStream(stream);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/teams/team-1"),
    );
  });

  it("includes team data in system prompt", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "team-1",
            name: "My OU Team",
            formatId: "gen9ou",
            mode: "freeform",
            slots: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-1",
    });
    await collectStream(stream);

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("My OU Team"),
      }),
    );
  });

  it("fetches meta context when formatId is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      formatId: "gen9ou",
    });
    await collectStream(stream);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/formats/gen9ou/usage"),
    );
  });

  it("includes page context in system prompt when provided", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      context: {
        pageType: "team-editor",
        contextSummary: "Editing team with 3 Pokemon",
      },
    });
    await collectStream(stream);

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Editing team with 3 Pokemon"),
      }),
    );
  });

  it("includes plan mode instructions in system prompt", async () => {
    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });
    await collectStream(stream);

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Planning"),
      }),
    );
  });

  it("handles team fetch failure gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", mockFetch);

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "bad-team",
    });

    // Should not throw — team context is optional
    expect(stream).toBeInstanceOf(ReadableStream);
    await collectStream(stream);
  });

  it("handles team fetch network error gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-1",
    });

    expect(stream).toBeInstanceOf(ReadableStream);
    await collectStream(stream);
  });

  it("passes disallowed MCP tools when page context has pageType", async () => {
    const { getDisallowedMcpTools } = await import("../tool-context");
    (getDisallowedMcpTools as ReturnType<typeof vi.fn>).mockReturnValue([
      "mcp__nasty-plot__create_team",
    ]);

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      context: {
        pageType: "pokemon-detail",
        contextSummary: "Viewing Pikachu",
      },
    });
    await collectStream(stream);

    expect(mockStreamCliChat).toHaveBeenCalledWith(
      expect.objectContaining({
        disallowedMcpTools: ["mcp__nasty-plot__create_team"],
      }),
    );
  });
});
