import {
  getMcpTools,
  executeMcpTool,
  getMcpResourceContext,
  disconnectMcp,
} from "../mcp-client";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockClose = vi.fn();
const mockListTools = vi.fn();
const mockCallTool = vi.fn();
const mockReadResource = vi.fn();

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class MockClient {
    connect = mockConnect;
    close = mockClose;
    listTools = mockListTools;
    callTool = mockCallTool;
    readResource = mockReadResource;
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class MockTransport {
    constructor() {}
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mcp-client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(async () => {
    await disconnectMcp();
  });

  describe("getMcpTools", () => {
    it("converts MCP tool schemas to OpenAI function-calling format", async () => {
      mockListTools.mockResolvedValue({
        tools: [
          {
            name: "get_pokemon",
            description: "Look up a Pokemon by ID",
            inputSchema: {
              type: "object",
              properties: { pokemonId: { type: "string" } },
              required: ["pokemonId"],
            },
          },
          {
            name: "search_pokemon",
            description: "Search for Pokemon",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
            },
          },
        ],
      });

      const tools = await getMcpTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]).toEqual({
        type: "function",
        function: {
          name: "get_pokemon",
          description: "Look up a Pokemon by ID",
          parameters: {
            type: "object",
            properties: { pokemonId: { type: "string" } },
            required: ["pokemonId"],
          },
        },
      });
    });

    it("returns empty array when MCP server is unavailable", async () => {
      mockConnect.mockRejectedValue(new Error("Connection refused"));

      const tools = await getMcpTools();

      expect(tools).toEqual([]);
    });
  });

  describe("executeMcpTool", () => {
    it("extracts text from MCP content array", async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"name":"Pikachu"}' }],
      });

      const result = await executeMcpTool("get_pokemon", {
        pokemonId: "pikachu",
      });

      expect(result).toBe('{"name":"Pikachu"}');
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "get_pokemon",
        arguments: { pokemonId: "pikachu" },
      });
    });

    it("joins multiple text content blocks", async () => {
      mockCallTool.mockResolvedValue({
        content: [
          { type: "text", text: "Part 1" },
          { type: "text", text: "Part 2" },
        ],
      });

      const result = await executeMcpTool("test_tool", {});

      expect(result).toBe("Part 1\nPart 2");
    });

    it("retries once on connection failure", async () => {
      mockCallTool
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "success" }],
        });

      const result = await executeMcpTool("test_tool", {});

      expect(result).toBe("success");
    });

    it("returns error JSON when both attempts fail", async () => {
      mockCallTool.mockRejectedValue(new Error("Permanently down"));

      const result = await executeMcpTool("test_tool", {});
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("Permanently down");
    });
  });

  describe("getMcpResourceContext", () => {
    it("loads and formats static resources", async () => {
      mockReadResource.mockImplementation(({ uri }: { uri: string }) => {
        const data: Record<string, string> = {
          "pokemon://type-chart": '{"Fire":{"Water":0.5}}',
          "pokemon://formats": '[{"id":"gen9ou"}]',
          "pokemon://natures": '{"Adamant":{"plus":"atk"}}',
          "pokemon://stat-formulas": "# Stat Formulas\nHP = ...",
        };
        return Promise.resolve({
          contents: [{ text: data[uri] || "" }],
        });
      });

      const context = await getMcpResourceContext();

      expect(context).toContain("# Reference Data");
      expect(context).toContain("type chart");
      expect(context).toContain("formats");
      expect(context).toContain("natures");
      expect(context).toContain("stat formulas");
    });

    it("returns empty string when MCP server is unavailable", async () => {
      mockConnect.mockRejectedValue(new Error("Connection refused"));

      const context = await getMcpResourceContext();

      expect(context).toBe("");
    });
  });
});
