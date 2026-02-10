import { streamChat } from "../chat.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("../openai-client", () => ({
  getOpenAI: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
  MODEL: "gpt-4o-test",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(content?: string, toolCalls?: unknown[]) {
  return {
    choices: [
      {
        delta: {
          content: content ?? null,
          tool_calls: toolCalls ?? undefined,
        },
      },
    ],
  };
}

async function* asyncIterator(chunks: unknown[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    events.push(text);
  }

  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("streamChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a readable stream", async () => {
    mockCreate.mockResolvedValue(
      asyncIterator([makeChunk("Hello")]),
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("streams content chunks", async () => {
    mockCreate.mockResolvedValue(
      asyncIterator([makeChunk("Hello "), makeChunk("world")]),
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });

    const events = await collectStream(stream);
    const joined = events.join("");

    expect(joined).toContain("Hello");
    expect(joined).toContain("world");
  });

  it("ends with [DONE]", async () => {
    mockCreate.mockResolvedValue(
      asyncIterator([makeChunk("test")]),
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });

    const events = await collectStream(stream);
    const lastEvent = events[events.length - 1];

    expect(lastEvent).toContain("[DONE]");
  });

  it("calls OpenAI with system prompt and user messages", async () => {
    mockCreate.mockResolvedValue(asyncIterator([makeChunk("ok")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Help with my team" }],
    });
    await collectStream(stream);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-test",
        stream: true,
      }),
    );
  });

  it("handles errors gracefully", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });

    const events = await collectStream(stream);
    const joined = events.join("");

    expect(joined).toContain("error");
    expect(joined).toContain("[DONE]");
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

    mockCreate.mockResolvedValue(asyncIterator([makeChunk("ok")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      teamId: "team-1",
    });
    await collectStream(stream);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/teams/team-1"),
    );
  });

  it("fetches meta context when formatId is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockCreate.mockResolvedValue(asyncIterator([makeChunk("ok")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
      formatId: "gen9ou",
    });
    await collectStream(stream);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/formats/gen9ou/usage"),
    );
  });

  it("handles tool calls", async () => {
    const toolCallChunks = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: { name: "search_pokemon", arguments: '{"query":' },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { arguments: '"pikachu"}' },
                },
              ],
            },
          },
        ],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "Pikachu" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // First call returns tool calls, second call returns text
    mockCreate
      .mockResolvedValueOnce(asyncIterator(toolCallChunks))
      .mockResolvedValueOnce(asyncIterator([makeChunk("Pikachu is great!")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Tell me about Pikachu" }],
    });

    const events = await collectStream(stream);
    const joined = events.join("");

    expect(joined).toContain("toolCall");
    expect(joined).toContain("search_pokemon");
  });
});
