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
  MODEL: "claude-sonnet-test",
}));

const mockGetMcpTools = vi.fn();
const mockExecuteMcpTool = vi.fn();
const mockGetMcpResourceContext = vi.fn();

vi.mock("../mcp-client", () => ({
  getMcpTools: (...args: unknown[]) => mockGetMcpTools(...args),
  executeMcpTool: (...args: unknown[]) => mockExecuteMcpTool(...args),
  getMcpResourceContext: (...args: unknown[]) =>
    mockGetMcpResourceContext(...args),
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

async function collectStream(
  stream: ReadableStream<Uint8Array>,
): Promise<string[]> {
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
    mockGetMcpTools.mockResolvedValue([
      {
        type: "function",
        function: {
          name: "get_pokemon",
          description: "Look up a Pokemon",
          parameters: {
            type: "object",
            properties: { pokemonId: { type: "string" } },
          },
        },
      },
    ]);
    mockExecuteMcpTool.mockResolvedValue('{"name":"Pikachu"}');
    mockGetMcpResourceContext.mockResolvedValue("");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a readable stream", async () => {
    mockCreate.mockResolvedValue(asyncIterator([makeChunk("Hello")]));

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
    mockCreate.mockResolvedValue(asyncIterator([makeChunk("test")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });

    const events = await collectStream(stream);
    const lastEvent = events[events.length - 1];

    expect(lastEvent).toContain("[DONE]");
  });

  it("calls LLM with system prompt and user messages", async () => {
    mockCreate.mockResolvedValue(asyncIterator([makeChunk("ok")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Help with my team" }],
    });
    await collectStream(stream);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-test",
        stream: true,
      }),
    );
  });

  it("passes MCP tools to LLM", async () => {
    mockCreate.mockResolvedValue(asyncIterator([makeChunk("ok")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });
    await collectStream(stream);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: "function",
            function: expect.objectContaining({ name: "get_pokemon" }),
          }),
        ]),
      }),
    );
  });

  it("omits tools when MCP returns empty array", async () => {
    mockGetMcpTools.mockResolvedValue([]);
    mockCreate.mockResolvedValue(asyncIterator([makeChunk("ok")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });
    await collectStream(stream);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tools).toBeUndefined();
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

  it("injects MCP resource context into system prompt", async () => {
    mockGetMcpResourceContext.mockResolvedValue(
      "\n# Reference Data\n\n## type chart\n{...}",
    );
    mockCreate.mockResolvedValue(asyncIterator([makeChunk("ok")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Hi" }],
    });
    await collectStream(stream);

    const systemMsg = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMsg.content).toContain("Reference Data");
  });

  it("handles tool calls via MCP", async () => {
    const toolCallChunks = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: {
                    name: "get_pokemon",
                    arguments: '{"pokemonId":',
                  },
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

    mockExecuteMcpTool.mockResolvedValue('{"name":"Pikachu","types":["Electric"]}');

    // First call returns tool calls, second returns text
    mockCreate
      .mockResolvedValueOnce(asyncIterator(toolCallChunks))
      .mockResolvedValueOnce(asyncIterator([makeChunk("Pikachu is great!")]));

    const stream = await streamChat({
      messages: [{ role: "user", content: "Tell me about Pikachu" }],
    });

    const events = await collectStream(stream);
    const joined = events.join("");

    expect(joined).toContain("toolCall");
    expect(joined).toContain("get_pokemon");
    expect(mockExecuteMcpTool).toHaveBeenCalledWith("get_pokemon", {
      pokemonId: "pikachu",
    });
  });
});
