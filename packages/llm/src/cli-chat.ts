import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { getToolLabel, isWriteTool } from "./tool-labels"
import { StreamParser } from "./stream-parser"
import type { SSEEvent } from "./sse-events"
import type { PageContextData } from "./context-builder"
import { MCP_URL, MODEL } from "./config"

const LOG_PREFIX = "[cli-chat]"
const TEMP_DIR = join(tmpdir(), "nasty-plot-cli")

const SYSTEM_PROMPT_SUFFIX = [
  "",
  "IMPORTANT: You are a Pokemon assistant chatbot, NOT a coding agent.",
  "You MUST only use the MCP tools (prefixed with mcp__nasty-plot__) and MCP resource tools to answer questions.",
  "NEVER attempt to use code tools like Bash, Read, Write, Edit, Glob, Grep, or any tool not prefixed with mcp__nasty-plot__.",
  "If data is not available via MCP tools, say so and use your own knowledge instead. Do not try to access the filesystem or codebase.",
].join("\n")

/** Built-in Claude Code tools to block — force model to use MCP tools only */
const BLOCKED_BUILTIN_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
  "TaskOutput",
  "NotebookEdit",
  "EnterPlanMode",
  "ExitPlanMode",
  "TodoWrite",
  "AskUserQuestion",
  "Skill",
  "TeamCreate",
  "TeamDelete",
  "SendMessage",
  "TaskStop",
  "ToolSearch",
]

/** Map model strings to CLI aliases */
function getCliModel(model: string): string {
  if (model.includes("opus")) return "opus"
  if (model.includes("haiku")) return "haiku"
  return "sonnet"
}

/** Write content to a temp file, returns the file path */
function writeTempFile(filename: string, content: string): string {
  mkdirSync(TEMP_DIR, { recursive: true })
  const filePath = join(TEMP_DIR, filename)
  writeFileSync(filePath, content)
  return filePath
}

function writeMcpConfig(): string {
  return writeTempFile(
    "mcp-config.json",
    JSON.stringify({ mcpServers: { "nasty-plot": { type: "http", url: MCP_URL } } }),
  )
}

function writeSystemPrompt(content: string): string {
  return writeTempFile("system-prompt.txt", content + SYSTEM_PROMPT_SUFFIX)
}

interface CliMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface CliChatOptions {
  messages: CliMessage[]
  systemPrompt: string
  model?: string
  signal?: AbortSignal
  pageContext?: PageContextData
  disallowedMcpTools?: string[]
}

/**
 * Format conversation history into a single prompt for the CLI.
 * System prompt is handled separately via --append-system-prompt-file.
 */
function buildPrompt(messages: CliMessage[]): string {
  const parts: string[] = []

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        // System is handled via the flag; skip here
        break
      case "assistant":
        parts.push(`<previous_response>\n${msg.content}\n</previous_response>`)
        break
      case "user":
        parts.push(msg.content)
        break
    }
  }

  return parts.join("\n\n").trim()
}

function buildCliArgs(
  model: string,
  mcpConfigPath: string,
  systemPromptPath: string,
  disallowedTools: string[],
  prompt: string,
): string[] {
  return [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model",
    model,
    "--dangerously-skip-permissions",
    "--mcp-config",
    mcpConfigPath,
    "--strict-mcp-config",
    "--disallowedTools",
    ...disallowedTools,
    "--append-system-prompt-file",
    systemPromptPath,
    "--setting-sources",
    "",
    "--no-session-persistence",
    "--max-turns",
    "50",
    prompt,
  ]
}

type Emitter = (event: SSEEvent) => void

function emitParsedContent(
  emit: Emitter,
  result: { cleanContent: string; events: SSEEvent[] },
): void {
  if (result.cleanContent) emit({ type: "content", content: result.cleanContent })
  for (const evt of result.events) emit(evt)
}

function extractTextDelta(msg: Record<string, unknown>): string | null {
  if (msg.type !== "stream_event") return null
  const event = msg.event as Record<string, unknown> | undefined
  if (event?.type !== "content_block_delta") return null
  const delta = event.delta as Record<string, unknown> | undefined
  if (delta?.type !== "text_delta" || !delta.text) return null
  return delta.text as string
}

function extractToolBlocks(msg: Record<string, unknown>): Array<Record<string, unknown>> | null {
  if (msg.type !== "assistant") return null
  const content = (msg.message as Record<string, unknown> | undefined)?.content as
    | Array<Record<string, unknown>>
    | undefined
  return content ?? null
}

function processToolBlock(
  block: Record<string, unknown>,
  activeTools: Map<string, Record<string, unknown>>,
  emit: Emitter,
  flushActiveTools: () => void,
): void {
  if (block.type === "tool_use") {
    const toolName = block.name as string
    const input = (block.input ?? {}) as Record<string, unknown>
    const label = getToolLabel(toolName)
    console.log(`${LOG_PREFIX} ▶ Tool call: ${toolName}(${JSON.stringify(input).slice(0, 200)})`)
    activeTools.set(toolName, input)
    emit({ type: "tool_start", name: toolName, label, input })

    if (isWriteTool(toolName)) {
      emit({ type: "action_notify", name: toolName, label, input })
    }
  } else if (block.type === "text" && block.text) {
    flushActiveTools()
  }
}

function logResult(msg: Record<string, unknown>, startMs: number): boolean {
  if (msg.type !== "result") return false

  const elapsed = (performance.now() - startMs).toFixed(0)
  const cost = msg.cost_usd ? `$${(msg.cost_usd as number).toFixed(4)}` : "n/a"
  const turns = msg.num_turns ?? "?"
  console.log(`${LOG_PREFIX} ◀ Result: ${elapsed}ms, ${turns} turns, cost=${cost}`)
  return true
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown spawn error"
}

/**
 * Spawn the Claude CLI directly with MCP tools and stream the response.
 *
 * The CLI handles the entire agent loop: tool discovery -> tool calls -> response.
 * We parse the stream-json output and emit typed SSE events.
 */
export function streamCliChat(options: CliChatOptions): ReadableStream<Uint8Array> {
  const mcpConfigPath = writeMcpConfig()
  const systemPromptPath = writeSystemPrompt(options.systemPrompt)
  const model = getCliModel(options.model ?? MODEL)
  const prompt = buildPrompt(options.messages)
  const disallowedTools = [...BLOCKED_BUILTIN_TOOLS, ...(options.disallowedMcpTools ?? [])]
  const args = buildCliArgs(model, mcpConfigPath, systemPromptPath, disallowedTools, prompt)

  const startMs = performance.now()
  console.log(
    `${LOG_PREFIX} === START === model=${model} mcp=${MCP_URL} prompt=${prompt.length} chars`,
  )

  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const emit: Emitter = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      let proc: ChildProcessWithoutNullStreams
      try {
        proc = spawn("claude", args, {
          cwd: TEMP_DIR,
          env: { ...process.env },
          stdio: ["pipe", "pipe", "pipe"],
        })
      } catch (err) {
        const msg = errorMessage(err)
        console.error(`${LOG_PREFIX} Spawn failed: ${msg}`)
        emit({ type: "error", error: msg })
        emit({ type: "done" })
        controller.close()
        return
      }

      proc.stdin?.end()
      console.log(`${LOG_PREFIX} PID: ${proc.pid}`)

      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          console.log(`${LOG_PREFIX} Abort signal received, killing PID ${proc.pid}`)
          proc.kill("SIGTERM")
        })
      }

      let buffer = ""
      const activeTools = new Map<string, Record<string, unknown>>()
      const streamParser = new StreamParser()
      let closed = false

      const flushActiveTools = (): void => {
        for (const name of activeTools.keys()) {
          emit({ type: "tool_end", name })
        }
        activeTools.clear()
      }

      const tryClose = (): void => {
        if (closed) return
        closed = true
        flushActiveTools()
        emit({ type: "done" })
        controller.close()
      }

      proc.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          let msg: Record<string, unknown>
          try {
            msg = JSON.parse(trimmed)
          } catch {
            continue
          }

          const text = extractTextDelta(msg)
          if (text) {
            flushActiveTools()
            emitParsedContent(emit, streamParser.process(text))
            continue
          }

          const blocks = extractToolBlocks(msg)
          if (blocks) {
            for (const block of blocks) {
              processToolBlock(block, activeTools, emit, flushActiveTools)
            }
            continue
          }

          if (logResult(msg, startMs)) {
            emitParsedContent(emit, streamParser.flush())
            flushActiveTools()
          }
        }
      })

      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim()
        if (text) console.error(`${LOG_PREFIX} stderr: ${text.slice(0, 300)}`)
      })

      proc.on("close", (code) => {
        const elapsed = (performance.now() - startMs).toFixed(0)
        console.log(`${LOG_PREFIX} === DONE === code=${code} elapsed=${elapsed}ms`)
        tryClose()
      })

      proc.on("error", (err) => {
        console.error(`${LOG_PREFIX} Process error: ${err.message}`)
        emit({ type: "error", error: err.message })
        tryClose()
      })
    },
  })
}
