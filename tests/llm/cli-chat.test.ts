// @vitest-environment node
import { EventEmitter } from "events"
import type { CliChatOptions } from "@nasty-plot/llm"
import { asMock } from "../test-utils"

// ---------------------------------------------------------------------------
// Mock child_process.spawn
// ---------------------------------------------------------------------------

let mockProcess: MockChildProcess

class MockChildProcess extends EventEmitter {
  stdin = { end: vi.fn() }
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  pid = 12345
  kill = vi.fn()
}

function createMockProcess(): MockChildProcess {
  return new MockChildProcess()
}

const mockSpawn = vi.fn(() => mockProcess)
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>()
  return {
    ...actual,
    spawn: mockSpawn,
    default: { ...actual, spawn: mockSpawn },
  }
})

// Mock @nasty-plot/db to prevent transitive fs.existsSync error from db/client.ts
vi.mock("@nasty-plot/db", () => ({
  prisma: {},
}))

const mockWriteFileSync = vi.fn()
const mockMkdirSync = vi.fn()
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>()
  return {
    ...actual,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
    default: { ...actual, writeFileSync: mockWriteFileSync, mkdirSync: mockMkdirSync },
  }
})

// Mock StreamParser to keep tests focused on cli-chat logic
let mockStreamParserProcess = vi.fn((text: string) => ({
  cleanContent: text,
  events: [] as unknown[],
}))
let mockStreamParserFlush = vi.fn(() => ({ cleanContent: "", events: [] as unknown[] }))

vi.mock("#llm/stream-parser", () => ({
  StreamParser: class MockStreamParser {
    process(text: string) {
      return mockStreamParserProcess(text)
    }
    flush() {
      return mockStreamParserFlush()
    }
  },
}))

// Mock tool-labels
vi.mock("#llm/tool-labels", () => ({
  getToolLabel: vi.fn((name: string) => `Label for ${name}`),
  isWriteTool: vi.fn(
    (name: string) => name.includes("add_pokemon") || name.includes("create_team"),
  ),
}))

// Mock tool-context
vi.mock("#llm/tool-context", () => ({
  getDisallowedMcpTools: vi.fn(() => []),
  getPageTypeFromPath: vi.fn(() => "other"),
}))

// ---------------------------------------------------------------------------
// Helper: collect all SSE events from a ReadableStream
// ---------------------------------------------------------------------------
async function collectSSEEvents(
  stream: ReadableStream<Uint8Array>,
): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const events: Array<Record<string, unknown>> = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    // Parse "data: {...}\n\n" lines
    const lines = text.split("\n\n").filter(Boolean)
    for (const line of lines) {
      const match = line.match(/^data: (.+)$/)
      if (match) {
        events.push(JSON.parse(match[1]))
      }
    }
  }
  return events
}

// ---------------------------------------------------------------------------
// Helper: emit a JSON line on mock stdout
// ---------------------------------------------------------------------------
function emitStdoutLine(proc: MockChildProcess, data: Record<string, unknown>): void {
  proc.stdout.emit("data", Buffer.from(JSON.stringify(data) + "\n"))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("streamCliChat", () => {
  let streamCliChat: typeof import("@nasty-plot/llm").streamCliChat
  let spawnFn: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockProcess = createMockProcess()
    mockStreamParserProcess = vi.fn((text: string) => ({
      cleanContent: text,
      events: [] as unknown[],
    }))
    mockStreamParserFlush = vi.fn(() => ({ cleanContent: "", events: [] as unknown[] }))
    // Re-import to get fresh module with mocks
    const mod = await import("@nasty-plot/llm")
    streamCliChat = mod.streamCliChat
    const cp = await import("child_process")
    spawnFn = asMock(cp.spawn)
  })

  const defaultOptions: CliChatOptions = {
    messages: [{ role: "user", content: "Hello" }],
    systemPrompt: "You are a Pokemon assistant.",
  }

  // -----------------------------------------------------------------------
  // Basic lifecycle
  // -----------------------------------------------------------------------

  it("returns a ReadableStream", () => {
    const stream = streamCliChat(defaultOptions)
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it("spawns claude CLI with correct arguments", async () => {
    const stream = streamCliChat(defaultOptions)
    const reader = stream.getReader()

    // Let the stream start, then close the process
    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)

    // Drain the stream

    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(spawnFn).toHaveBeenCalledTimes(1)
    const args = spawnFn.mock.calls[0][1] as string[]
    expect(args).toContain("--print")
    expect(args).toContain("--output-format")
    expect(args).toContain("stream-json")
    expect(args).toContain("--model")
    expect(args).toContain("--mcp-config")
    expect(args).toContain("--disallowedTools")
    expect(args).toContain("--max-turns")
    expect(args).toContain("50")
    // The prompt should be the last argument
    expect(args[args.length - 1]).toBe("Hello")
  })

  it("calls stdin.end() after spawning", async () => {
    const stream = streamCliChat(defaultOptions)
    const reader = stream.getReader()

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)

    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(mockProcess.stdin.end).toHaveBeenCalled()
  })

  it("emits done event and closes stream on process close", async () => {
    const stream = streamCliChat(defaultOptions)

    // Allow start() to run
    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    expect(events[events.length - 1]).toEqual({ type: "done" })
  })

  // -----------------------------------------------------------------------
  // Content deltas
  // -----------------------------------------------------------------------

  it("emits content SSE events from text_delta stream events", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hello trainer!" },
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    expect(events).toContainEqual({ type: "content", content: "Hello trainer!" })
  })

  it("skips empty text deltas", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "" },
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    // Should only have "done", no content events
    const contentEvents = events.filter((e) => e.type === "content")
    expect(contentEvents).toHaveLength(0)
  })

  // -----------------------------------------------------------------------
  // Tool use blocks
  // -----------------------------------------------------------------------

  it("emits tool_start SSE events for tool_use blocks in assistant messages", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "mcp__nasty-plot__get_pokemon",
            input: { pokemonId: "garchomp" },
          },
        ],
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const toolStart = events.find((e) => e.type === "tool_start")
    expect(toolStart).toBeDefined()
    expect(toolStart!.name).toBe("mcp__nasty-plot__get_pokemon")
    expect(toolStart!.input).toEqual({ pokemonId: "garchomp" })
  })

  it("emits action_notify for write tools", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "add_pokemon_to_team",
            input: { teamId: "t1", pokemonId: "pikachu" },
          },
        ],
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const actionNotify = events.find((e) => e.type === "action_notify")
    expect(actionNotify).toBeDefined()
    expect(actionNotify!.name).toBe("add_pokemon_to_team")
  })

  it("does NOT emit action_notify for read-only tools", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "mcp__nasty-plot__get_pokemon",
            input: { pokemonId: "garchomp" },
          },
        ],
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const actionNotify = events.find((e) => e.type === "action_notify")
    expect(actionNotify).toBeUndefined()
  })

  it("flushes active tools when text block appears after tool_use", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "mcp__nasty-plot__get_pokemon",
            input: { pokemonId: "garchomp" },
          },
          {
            type: "text",
            text: "Here are the results",
          },
        ],
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const toolEnd = events.find((e) => e.type === "tool_end")
    expect(toolEnd).toBeDefined()
    expect(toolEnd!.name).toBe("mcp__nasty-plot__get_pokemon")
  })

  it("handles tool_use with no input", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "mcp__nasty-plot__list_teams",
            // no input field
          },
        ],
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const toolStart = events.find((e) => e.type === "tool_start")
    expect(toolStart).toBeDefined()
    expect(toolStart!.input).toEqual({})
  })

  // -----------------------------------------------------------------------
  // Result message
  // -----------------------------------------------------------------------

  it("flushes stream parser and active tools on result message", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    // Start a tool
    emitStdoutLine(mockProcess, {
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "get_pokemon", input: { pokemonId: "pikachu" } }],
      },
    })

    // Emit result
    emitStdoutLine(mockProcess, {
      type: "result",
      cost_usd: 0.0123,
      num_turns: 3,
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const toolEnd = events.find((e) => e.type === "tool_end")
    expect(toolEnd).toBeDefined()
  })

  it("handles result without cost_usd", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "result",
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    expect(events[events.length - 1]).toEqual({ type: "done" })
  })

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("emits error SSE event on process error", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    mockProcess.emit("error", new Error("ENOENT: claude not found"))

    const events = await collectSSEEvents(stream)
    expect(events).toContainEqual({
      type: "error",
      error: "ENOENT: claude not found",
    })
    expect(events[events.length - 1]).toEqual({ type: "done" })
  })

  it("handles spawn failure via thrown error", async () => {
    // Make spawn throw
    spawnFn.mockImplementationOnce(() => {
      throw new Error("spawn ENOENT")
    })

    const stream = streamCliChat(defaultOptions)

    const events = await collectSSEEvents(stream)
    expect(events).toContainEqual({ type: "error", error: "spawn ENOENT" })
    expect(events[events.length - 1]).toEqual({ type: "done" })
  })

  it("handles spawn failure with non-Error throw", async () => {
    spawnFn.mockImplementationOnce(() => {
      throw "string error"
    })

    const stream = streamCliChat(defaultOptions)

    const events = await collectSSEEvents(stream)
    expect(events).toContainEqual({ type: "error", error: "Unknown spawn error" })
  })

  // -----------------------------------------------------------------------
  // stderr handling
  // -----------------------------------------------------------------------

  it("logs stderr but does not emit SSE events", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    mockProcess.stderr.emit("data", Buffer.from("Warning: something\n"))
    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const errorEvents = events.filter((e) => e.type === "error")
    expect(errorEvents).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: something"))

    consoleSpy.mockRestore()
  })

  it("ignores empty stderr", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    mockProcess.stderr.emit("data", Buffer.from("   \n"))
    mockProcess.emit("close", 0)

    await collectSSEEvents(stream)
    // Should not have logged because trimmed text is empty
    const stderrCalls = consoleSpy.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("stderr"),
    )
    expect(stderrCalls).toHaveLength(0)

    consoleSpy.mockRestore()
  })

  // -----------------------------------------------------------------------
  // Non-JSON lines
  // -----------------------------------------------------------------------

  it("silently skips non-JSON stdout lines", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    mockProcess.stdout.emit("data", Buffer.from("not-json-line\n"))
    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    // Only "done" should be present, no errors from parsing
    expect(events).toEqual([{ type: "done" }])
  })

  it("skips empty lines in stdout", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    mockProcess.stdout.emit("data", Buffer.from("\n\n\n"))
    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    expect(events).toEqual([{ type: "done" }])
  })

  // -----------------------------------------------------------------------
  // Abort signal
  // -----------------------------------------------------------------------

  it("kills process on abort signal", async () => {
    const controller = new AbortController()
    const stream = streamCliChat({
      ...defaultOptions,
      signal: controller.signal,
    })

    await new Promise((r) => setTimeout(r, 10))

    controller.abort()

    // The kill should have been called
    expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")

    mockProcess.emit("close", 1)
    await collectSSEEvents(stream)
  })

  // -----------------------------------------------------------------------
  // Model mapping
  // -----------------------------------------------------------------------

  it("maps opus model correctly", async () => {
    const stream = streamCliChat({
      ...defaultOptions,
      model: "claude-opus-4",
    })

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    const args = spawnFn.mock.calls[0][1] as string[]
    const modelIdx = args.indexOf("--model")
    expect(args[modelIdx + 1]).toBe("opus")
  })

  it("maps haiku model correctly", async () => {
    const stream = streamCliChat({
      ...defaultOptions,
      model: "claude-haiku-3",
    })

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    const args = spawnFn.mock.calls[0][1] as string[]
    const modelIdx = args.indexOf("--model")
    expect(args[modelIdx + 1]).toBe("haiku")
  })

  it("defaults to sonnet for unknown models", async () => {
    const stream = streamCliChat({
      ...defaultOptions,
      model: "claude-something-else",
    })

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    const args = spawnFn.mock.calls[0][1] as string[]
    const modelIdx = args.indexOf("--model")
    expect(args[modelIdx + 1]).toBe("sonnet")
  })

  // -----------------------------------------------------------------------
  // buildPrompt (tested indirectly through spawn args)
  // -----------------------------------------------------------------------

  it("formats user messages as plain text", async () => {
    const stream = streamCliChat({
      ...defaultOptions,
      messages: [{ role: "user", content: "What is Garchomp?" }],
    })

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    const args = spawnFn.mock.calls[0][1] as string[]
    const prompt = args[args.length - 1]
    expect(prompt).toBe("What is Garchomp?")
  })

  it("wraps assistant messages in previous_response tags", async () => {
    const stream = streamCliChat({
      ...defaultOptions,
      messages: [
        { role: "assistant", content: "I can help!" },
        { role: "user", content: "Thanks" },
      ],
    })

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    const args = spawnFn.mock.calls[0][1] as string[]
    const prompt = args[args.length - 1]
    expect(prompt).toContain("<previous_response>")
    expect(prompt).toContain("I can help!")
    expect(prompt).toContain("</previous_response>")
    expect(prompt).toContain("Thanks")
  })

  it("skips system messages in buildPrompt (handled via flag)", async () => {
    const stream = streamCliChat({
      ...defaultOptions,
      messages: [
        { role: "system", content: "System instructions" },
        { role: "user", content: "Hello" },
      ],
    })

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    const args = spawnFn.mock.calls[0][1] as string[]
    const prompt = args[args.length - 1]
    expect(prompt).not.toContain("System instructions")
    expect(prompt).toBe("Hello")
  })

  // -----------------------------------------------------------------------
  // disallowedMcpTools
  // -----------------------------------------------------------------------

  it("passes disallowedMcpTools into blocked tools", async () => {
    const stream = streamCliChat({
      ...defaultOptions,
      disallowedMcpTools: ["mcp__nasty-plot__create_team", "mcp__nasty-plot__get_team"],
    })

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    const args = spawnFn.mock.calls[0][1] as string[]
    expect(args).toContain("mcp__nasty-plot__create_team")
    expect(args).toContain("mcp__nasty-plot__get_team")
  })

  // -----------------------------------------------------------------------
  // writeMcpConfig and writeSystemPrompt (tested via fs mock)
  // -----------------------------------------------------------------------

  it("writes MCP config and system prompt files", async () => {
    const fs = await import("fs")
    const writeFileSync = asMock(fs.writeFileSync)

    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    // Should have written MCP config (first call) and system prompt (second call)
    expect(writeFileSync).toHaveBeenCalledTimes(2)

    // MCP config
    const mcpConfigContent = writeFileSync.mock.calls[0][1] as string
    const parsed = JSON.parse(mcpConfigContent)
    expect(parsed.mcpServers).toBeDefined()
    expect(parsed.mcpServers["nasty-plot"]).toBeDefined()

    // System prompt
    const systemPromptContent = writeFileSync.mock.calls[1][1] as string
    expect(systemPromptContent).toContain("You are a Pokemon assistant.")
    expect(systemPromptContent).toContain("IMPORTANT: You are a Pokemon assistant chatbot")
  })

  it("creates temp directory with recursive flag", async () => {
    const fs = await import("fs")
    const mkdirSync = asMock(fs.mkdirSync)

    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))
    mockProcess.emit("close", 0)
    await collectSSEEvents(stream)

    // Should have called mkdirSync for both MCP config and system prompt
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining("nasty-plot-cli"), {
      recursive: true,
    })
  })

  // -----------------------------------------------------------------------
  // Multiple close calls (tryClose idempotency)
  // -----------------------------------------------------------------------

  it("handles multiple close events without double-closing the stream", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    // Both error and close fire
    mockProcess.emit("error", new Error("oops"))
    mockProcess.emit("close", 1)

    const events = await collectSSEEvents(stream)
    // Should have error + done, but only one done
    const doneEvents = events.filter((e) => e.type === "done")
    expect(doneEvents).toHaveLength(1)
  })

  // -----------------------------------------------------------------------
  // Buffered stdout (partial JSON)
  // -----------------------------------------------------------------------

  it("handles partial JSON lines split across chunks", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    const fullLine = JSON.stringify({
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "partial test" },
      },
    })

    // Split the JSON across two chunks
    const mid = Math.floor(fullLine.length / 2)
    mockProcess.stdout.emit("data", Buffer.from(fullLine.slice(0, mid)))
    mockProcess.stdout.emit("data", Buffer.from(fullLine.slice(mid) + "\n"))

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    expect(events).toContainEqual({ type: "content", content: "partial test" })
  })

  // -----------------------------------------------------------------------
  // Content delta flushes active tools
  // -----------------------------------------------------------------------

  it("flushes active tools before emitting content delta", async () => {
    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    // First, start a tool
    emitStdoutLine(mockProcess, {
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "get_pokemon", input: {} }],
      },
    })

    // Then a content delta should flush the tool
    emitStdoutLine(mockProcess, {
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Response text" },
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const toolStartIdx = events.findIndex((e) => e.type === "tool_start")
    const toolEndIdx = events.findIndex((e) => e.type === "tool_end")
    const contentIdx = events.findIndex(
      (e) => e.type === "content" && e.content === "Response text",
    )

    expect(toolStartIdx).toBeLessThan(toolEndIdx)
    expect(toolEndIdx).toBeLessThan(contentIdx)
  })

  // -----------------------------------------------------------------------
  // Plan events from StreamParser
  // -----------------------------------------------------------------------

  it("forwards plan events from StreamParser", async () => {
    // Override the mock to return plan events
    mockStreamParserProcess.mockReturnValue({
      cleanContent: "text",
      events: [{ type: "plan_start", steps: [{ text: "Step 1" }] }],
    })

    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, {
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "planning..." },
      },
    })

    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    const planStart = events.find((e) => e.type === "plan_start")
    expect(planStart).toBeDefined()
  })

  // -----------------------------------------------------------------------
  // Result with flush content from StreamParser
  // -----------------------------------------------------------------------

  it("flushes remaining StreamParser content on result message", async () => {
    // Override flush mock to return remaining content and events
    mockStreamParserFlush.mockReturnValue({
      cleanContent: "remaining content",
      events: [{ type: "plan_step_update", stepIndex: 0, status: "complete" }],
    })

    const stream = streamCliChat(defaultOptions)

    await new Promise((r) => setTimeout(r, 10))

    emitStdoutLine(mockProcess, { type: "result", cost_usd: 0.01, num_turns: 1 })
    mockProcess.emit("close", 0)

    const events = await collectSSEEvents(stream)
    expect(events).toContainEqual({ type: "content", content: "remaining content" })
    expect(events).toContainEqual({ type: "plan_step_update", stepIndex: 0, status: "complete" })
  })
})
