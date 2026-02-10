import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { getToolLabel, isWriteTool } from "./tool-labels"
import { StreamParser } from "./stream-parser"
import type { SSEEvent } from "./sse-events"
import type { PageContextData } from "./context-builder"


const MCP_URL = process.env.MCP_URL || "http://localhost:3001/mcp"
const CLI_MODEL = process.env.LLM_MODEL || "opus"
const LOG_PREFIX = "[cli-chat]"

/** Map model strings to CLI aliases */
function getCliModel(model: string): string {
  if (model.includes("opus")) return "opus"
  if (model.includes("haiku")) return "haiku"
  return "sonnet"
}

/** Write MCP config to temp file for --mcp-config flag */
function writeMcpConfig(): string {
  const dir = join(tmpdir(), "nasty-plot-cli")
  mkdirSync(dir, { recursive: true })
  const configPath = join(dir, "mcp-config.json")

  writeFileSync(
    configPath,
    JSON.stringify({
      mcpServers: {
        "nasty-plot": { type: "http", url: MCP_URL },
      },
    }),
  )
  return configPath
}

/** Write system prompt to temp file for --system-prompt flag */
function writeSystemPrompt(content: string): string {
  const dir = join(tmpdir(), "nasty-plot-cli")
  mkdirSync(dir, { recursive: true })
  const promptPath = join(dir, "system-prompt.txt")

  const wrapped = [
    content,
    "",
    "IMPORTANT: You are a Pokemon assistant chatbot, NOT a coding agent.",
    "You MUST only use the MCP tools (prefixed with mcp__nasty-plot__) and MCP resource tools to answer questions.",
    "NEVER attempt to use code tools like Bash, Read, Write, Edit, Glob, Grep, or any tool not prefixed with mcp__nasty-plot__.",
    "If data is not available via MCP tools, say so and use your own knowledge instead. Do not try to access the filesystem or codebase.",
  ].join("\n")

  writeFileSync(promptPath, wrapped)
  return promptPath
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

/**
 * Spawn the Claude CLI directly with MCP tools and stream the response.
 *
 * The CLI handles the entire agent loop: tool discovery → tool calls → response.
 * We parse the stream-json output and emit typed SSE events.
 */
export function streamCliChat(options: CliChatOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const mcpConfigPath = writeMcpConfig()
  const systemPromptPath = writeSystemPrompt(options.systemPrompt)
  const model = getCliModel(options.model || CLI_MODEL)
  const prompt = buildPrompt(options.messages)

  const t0 = performance.now()

  return new ReadableStream({
    start(controller) {
      // Block built-in code tools so the model uses MCP tools for data lookups.
      const blockedTools = [
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

      // Also block page-specific MCP tools if a page context is provided
      if (options.disallowedMcpTools) {
        blockedTools.push(...options.disallowedMcpTools)
      }

      const args = [
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
        ...blockedTools,
        "--append-system-prompt-file",
        systemPromptPath,
        "--setting-sources",
        "",
        "--no-session-persistence",
        "--max-turns",
        "50",
        prompt,
      ]

      console.log(
        `${LOG_PREFIX} === START === model=${model} mcp=${MCP_URL} prompt=${prompt.length} chars`,
      )

      // Spawn from the temp dir so the CLI doesn't load this project's
      // CLAUDE.md as project instructions (which teaches it about the codebase).
      const cliCwd = join(tmpdir(), "nasty-plot-cli")

      let proc: ChildProcessWithoutNullStreams
      try {
        proc = spawn("claude", args, {
          cwd: cliCwd,
          env: { ...process.env },
          stdio: ["pipe", "pipe", "pipe"],
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown spawn error"
        console.error(`${LOG_PREFIX} Spawn failed: ${msg}`)
        sendSSE(controller, encoder, { type: "error", error: msg })
        sendSSE(controller, encoder, { type: "done" })
        controller.close()
        return
      }

      proc.stdin?.end()
      console.log(`${LOG_PREFIX} PID: ${proc.pid}`)

      // Wire up abort signal to kill subprocess
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

      function flushActiveTools(): void {
        for (const name of activeTools.keys()) {
          sendSSE(controller, encoder, { type: "tool_end", name })
        }
        activeTools.clear()
      }

      function tryClose(): void {
        if (closed) return
        closed = true
        flushActiveTools()
        sendSSE(controller, encoder, { type: "done" })
        controller.close()
      }

      proc.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const msg = JSON.parse(trimmed)

            // Content delta — pipe through StreamParser to strip plan XML tags
            if (
              msg.type === "stream_event" &&
              msg.event?.type === "content_block_delta" &&
              msg.event?.delta?.type === "text_delta"
            ) {
              const text = msg.event.delta.text
              if (text) {
                flushActiveTools()
                const { cleanContent, events: planEvents } = streamParser.process(text)
                if (cleanContent) {
                  sendSSE(controller, encoder, { type: "content", content: cleanContent })
                }
                for (const evt of planEvents) {
                  sendSSE(controller, encoder, evt)
                }
              }
            }

            // Assistant message — check for tool_use blocks
            if (msg.type === "assistant" && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === "tool_use") {
                  const toolName = block.name as string
                  const input = (block.input ?? {}) as Record<string, unknown>
                  const label = getToolLabel(toolName)
                  const inputSummary = JSON.stringify(input).slice(0, 200)
                  console.log(`${LOG_PREFIX} ▶ Tool call: ${toolName}(${inputSummary})`)
                  activeTools.set(toolName, input)
                  sendSSE(controller, encoder, {
                    type: "tool_start",
                    name: toolName,
                    label,
                    input,
                  })

                  // Emit action notification for write tools
                  if (isWriteTool(toolName)) {
                    sendSSE(controller, encoder, {
                      type: "action_notify",
                      name: toolName,
                      label,
                      input,
                    })
                  }
                }
                if (block.type === "text" && block.text) {
                  flushActiveTools()
                }
              }
            }

            // Result — the CLI is done
            if (msg.type === "result") {
              const elapsed = (performance.now() - t0).toFixed(0)
              const cost = msg.cost_usd ? `$${msg.cost_usd.toFixed(4)}` : "n/a"
              const turns = msg.num_turns ?? "?"
              console.log(`${LOG_PREFIX} ◀ Result: ${elapsed}ms, ${turns} turns, cost=${cost}`)
              // Flush any remaining content from the stream parser
              const { cleanContent, events: finalEvents } = streamParser.flush()
              if (cleanContent) {
                sendSSE(controller, encoder, { type: "content", content: cleanContent })
              }
              for (const evt of finalEvents) {
                sendSSE(controller, encoder, evt)
              }
              flushActiveTools()
            }
          } catch {
            // Non-JSON line, skip
          }
        }
      })

      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim()
        if (text) {
          console.error(`${LOG_PREFIX} stderr: ${text.slice(0, 300)}`)
        }
      })

      proc.on("close", (code) => {
        const elapsed = (performance.now() - t0).toFixed(0)
        console.log(`${LOG_PREFIX} === DONE === code=${code} elapsed=${elapsed}ms`)
        tryClose()
      })

      proc.on("error", (err) => {
        console.error(`${LOG_PREFIX} Process error: ${err.message}`)
        sendSSE(controller, encoder, { type: "error", error: err.message })
        tryClose()
      })
    },
  })
}

function sendSSE(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: SSEEvent,
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
}
