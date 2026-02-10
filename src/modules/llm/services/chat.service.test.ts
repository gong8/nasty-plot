vi.mock("./openai-client", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  MODEL: "test-model",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { openai } from "./openai-client";
import { streamChat } from "./chat.service";

const mockCreate = openai.chat.completions.create as ReturnType<typeof vi.fn>;

function makeAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length) {
            return { value: items[i++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

function makeChunk(content: string) {
  return {
    choices: [{ delta: { content, tool_calls: undefined } }],
  };
}

function makeToolCallChunk(index: number, id: string, name: string, args: string) {
  return {
    choices: [
      {
        delta: {
          content: undefined,
          tool_calls: [
            {
              index,
              id,
              function: { name, arguments: args },
            },
          ],
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
});

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string[]> {
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

describe("streamChat", () => {
  it("streams text content from OpenAI", async () => {
    mockCreate.mockResolvedValue(
      makeAsyncIterable([
        makeChunk("Hello"),
        makeChunk(" world"),
      ])
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "hi", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    const text = events.join("");

    expect(text).toContain('"content":"Hello"');
    expect(text).toContain('"content":" world"');
    expect(text).toContain("[DONE]");
  });

  it("handles tool calls", async () => {
    // First call returns tool call, second returns text
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "search_pokemon", '{"query":"pikachu"}'),
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("Pikachu is Electric type")])
      );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ name: "pikachu", types: ["Electric"] }),
    });

    const stream = await streamChat({
      messages: [{ role: "user", content: "tell me about pikachu", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    const text = events.join("");

    expect(text).toContain("search_pokemon");
    expect(text).toContain("executing");
    expect(text).toContain("complete");
    expect(text).toContain("[DONE]");
  });

  it("adds team context when teamId is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "team-1",
          name: "Test Team",
          formatId: "gen9ou",
          slots: [],
        },
      }),
    });

    mockCreate.mockResolvedValue(
      makeAsyncIterable([makeChunk("response")])
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "analyze", id: 1, createdAt: "" }],
      teamId: "team-1",
    });

    await readStream(stream);

    // Verify fetch was called for team data
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/teams/team-1")
    );
  });

  it("adds meta context when formatId is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    mockCreate.mockResolvedValue(
      makeAsyncIterable([makeChunk("response")])
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "meta", id: 1, createdAt: "" }],
      formatId: "gen9ou",
    });

    await readStream(stream);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/formats/gen9ou/usage")
    );
  });

  it("handles team context fetch failure gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    mockCreate.mockResolvedValue(
      makeAsyncIterable([makeChunk("response")])
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "hi", id: 1, createdAt: "" }],
      teamId: "team-1",
      formatId: "gen9ou",
    });

    const events = await readStream(stream);
    const text = events.join("");
    expect(text).toContain("[DONE]");
  });

  it("handles OpenAI stream error", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));

    const stream = await streamChat({
      messages: [{ role: "user", content: "hi", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    const text = events.join("");

    expect(text).toContain("error");
    expect(text).toContain("[DONE]");
  });

  it("handles empty delta in chunks", async () => {
    mockCreate.mockResolvedValue(
      makeAsyncIterable([
        { choices: [{ delta: {} }] },
        { choices: [] },
        makeChunk("text"),
      ])
    );

    const stream = await streamChat({
      messages: [{ role: "user", content: "hi", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    const text = events.join("");
    expect(text).toContain("text");
    expect(text).toContain("[DONE]");
  });

  it("executeTool handles unknown tool name", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "unknown_tool", "{}"),
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("hmm")])
      );

    const stream = await streamChat({
      messages: [{ role: "user", content: "test", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    const text = events.join("");
    expect(text).toContain("[DONE]");
  });

  it("executeTool handles fetch error in tool execution", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "get_usage_stats", '{"formatId":"gen9ou"}'),
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("result")])
      );

    mockFetch.mockRejectedValue(new Error("network"));

    const stream = await streamChat({
      messages: [{ role: "user", content: "usage", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    const text = events.join("");
    expect(text).toContain("[DONE]");
  });

  it("handles calculate_damage tool", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "calculate_damage", '{"attackerPokemon":"garchomp","defenderPokemon":"heatran","moveName":"Earthquake"}'),
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("damage result")])
      );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ minDamage: 100, maxDamage: 118 }),
    });

    const stream = await streamChat({
      messages: [{ role: "user", content: "calc", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    expect(events.join("")).toContain("[DONE]");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/damage-calc"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("handles analyze_team tool", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "analyze_team", '{"teamId":"team-1"}'),
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("analysis")])
      );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ coverage: {} }),
    });

    const stream = await streamChat({
      messages: [{ role: "user", content: "analyze", id: 1, createdAt: "" }],
    });

    await readStream(stream);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/teams/team-1/analysis")
    );
  });

  it("handles suggest_teammates tool", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "suggest_teammates", '{"teamId":"team-1","formatId":"gen9ou"}'),
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("suggestions")])
      );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recommendations: [] }),
    });

    const stream = await streamChat({
      messages: [{ role: "user", content: "suggest", id: 1, createdAt: "" }],
    });

    await readStream(stream);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/recommend"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("handles malformed tool call arguments", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "search_pokemon", "invalid json{{{"),
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("recovered")])
      );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const stream = await streamChat({
      messages: [{ role: "user", content: "test", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    expect(events.join("")).toContain("[DONE]");
  });

  it("accumulates tool call arguments across chunks", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeAsyncIterable([
          makeToolCallChunk(0, "call-1", "search_pokemon", '{"query":'),
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: '"pikachu"}' } },
                  ],
                },
              },
            ],
          },
        ])
      )
      .mockResolvedValueOnce(
        makeAsyncIterable([makeChunk("found")])
      );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ name: "pikachu" }),
    });

    const stream = await streamChat({
      messages: [{ role: "user", content: "search", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    expect(events.join("")).toContain("[DONE]");
  });

  it("respects max tool rounds limit", async () => {
    // Always return tool calls to test the round limit
    const toolStream = makeAsyncIterable([
      makeToolCallChunk(0, "call-1", "search_pokemon", '{"query":"test"}'),
    ]);

    mockCreate.mockResolvedValue(toolStream);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const stream = await streamChat({
      messages: [{ role: "user", content: "loop", id: 1, createdAt: "" }],
    });

    const events = await readStream(stream);
    // Should eventually stop and close with [DONE]
    expect(events.join("")).toContain("[DONE]");
  });
});
