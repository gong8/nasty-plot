import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const MCP_URL = process.env.MCP_URL || "http://localhost:3001/mcp";
const CLI_MODEL = process.env.LLM_MODEL || "opus";
const LOG_PREFIX = "[cli-chat]";

/** Map model strings to CLI aliases */
function getCliModel(model: string): string {
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  return "sonnet";
}

/** Write MCP config to temp file for --mcp-config flag */
function writeMcpConfig(): string {
  const dir = join(tmpdir(), "nasty-plot-cli");
  mkdirSync(dir, { recursive: true });
  const configPath = join(dir, "mcp-config.json");

  writeFileSync(
    configPath,
    JSON.stringify({
      mcpServers: {
        "nasty-plot": { type: "http", url: MCP_URL },
      },
    }),
  );
  return configPath;
}

/** Write system prompt to temp file for --system-prompt flag */
function writeSystemPrompt(content: string): string {
  const dir = join(tmpdir(), "nasty-plot-cli");
  mkdirSync(dir, { recursive: true });
  const promptPath = join(dir, "system-prompt.txt");

  // Wrap the app's system prompt with guardrails to keep the model
  // focused on MCP tools and prevent it from trying to use code tools.
  const wrapped = [
    content,
    "",
    "IMPORTANT: You are a Pokemon assistant chatbot, NOT a coding agent.",
    "You MUST only use the MCP tools (prefixed with mcp__nasty-plot__) and MCP resource tools to answer questions.",
    "NEVER attempt to use code tools like Bash, Read, Write, Edit, Glob, Grep, or any tool not prefixed with mcp__nasty-plot__.",
    "If data is not available via MCP tools, say so and use your own knowledge instead. Do not try to access the filesystem or codebase.",
  ].join("\n");

  writeFileSync(promptPath, wrapped);
  return promptPath;
}

interface CliMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CliChatOptions {
  messages: CliMessage[];
  systemPrompt: string;
  model?: string;
}

/**
 * Format conversation history into a single prompt for the CLI.
 * System prompt is handled separately via --append-system-prompt-file.
 */
function buildPrompt(messages: CliMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        // System is handled via the flag; skip here
        break;
      case "assistant":
        parts.push(`<previous_response>\n${msg.content}\n</previous_response>`);
        break;
      case "user":
        parts.push(msg.content);
        break;
    }
  }

  return parts.join("\n\n").trim();
}

/**
 * Spawn the Claude CLI directly with MCP tools and stream the response.
 *
 * The CLI handles the entire agent loop: tool discovery → tool calls → response.
 * We just parse the stream-json output and forward text content as SSE events.
 */
export function streamCliChat(
  options: CliChatOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const mcpConfigPath = writeMcpConfig();
  const systemPromptPath = writeSystemPrompt(options.systemPrompt);
  const model = getCliModel(options.model || CLI_MODEL);
  const prompt = buildPrompt(options.messages);

  const t0 = performance.now();

  return new ReadableStream({
    start(controller) {
      // Block built-in code tools so the model uses MCP tools for data lookups.
      // Keep ListMcpResourcesTool and ReadMcpResourceTool for resource access.
      const blockedTools = [
        "Bash", "Read", "Write", "Edit", "Glob", "Grep",
        "WebFetch", "WebSearch", "Task", "TaskOutput", "NotebookEdit",
        "EnterPlanMode", "ExitPlanMode", "TodoWrite", "AskUserQuestion",
        "Skill", "TeamCreate", "TeamDelete", "SendMessage", "TaskStop",
        "ToolSearch",
      ];

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
      ];

      console.log(
        `${LOG_PREFIX} === START === model=${model} mcp=${MCP_URL} prompt=${prompt.length} chars`,
      );

      // Spawn from the temp dir so the CLI doesn't load this project's
      // CLAUDE.md as project instructions (which teaches it about the codebase).
      const cliCwd = join(tmpdir(), "nasty-plot-cli");

      let proc: ChildProcessWithoutNullStreams;
      try {
        proc = spawn("claude", args, {
          cwd: cliCwd,
          env: { ...process.env },
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown spawn error";
        console.error(`${LOG_PREFIX} Spawn failed: ${msg}`);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      proc.stdin?.end();

      console.log(`${LOG_PREFIX} PID: ${proc.pid}`);

      let buffer = "";
      // Track active tool calls so we can emit "complete" when we see text resume
      const activeTools = new Set<string>();

      function send(data: Record<string, unknown>): void {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      function flushActiveTools(): void {
        for (const name of activeTools) {
          send({ toolCall: { name, status: "complete" } });
        }
        activeTools.clear();
      }

      proc.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const msg = JSON.parse(trimmed);

            // Content delta — stream text to client
            if (
              msg.type === "stream_event" &&
              msg.event?.type === "content_block_delta" &&
              msg.event?.delta?.type === "text_delta"
            ) {
              const text = msg.event.delta.text;
              if (text) {
                // If we had active tool calls, they've completed
                flushActiveTools();
                send({ content: text });
              }
            }

            // Assistant message — check for tool_use blocks
            if (msg.type === "assistant" && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === "tool_use") {
                  const toolName = block.name as string;
                  const inputSummary = JSON.stringify(block.input ?? {}).slice(
                    0,
                    200,
                  );
                  console.log(
                    `${LOG_PREFIX} ▶ Tool call: ${toolName}(${inputSummary})`,
                  );
                  activeTools.add(toolName);
                  send({ toolCall: { name: toolName, status: "executing" } });
                }
                if (block.type === "text" && block.text) {
                  // Text block in assistant message (non-streaming final content)
                  flushActiveTools();
                }
              }
            }

            // Result — the CLI is done
            if (msg.type === "result") {
              const elapsed = (performance.now() - t0).toFixed(0);
              const cost = msg.cost_usd
                ? `$${msg.cost_usd.toFixed(4)}`
                : "n/a";
              const turns = msg.num_turns ?? "?";
              console.log(
                `${LOG_PREFIX} ◀ Result: ${elapsed}ms, ${turns} turns, cost=${cost}`,
              );
              flushActiveTools();
            }
          } catch {
            // Non-JSON line, skip
          }
        }
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
          console.error(`${LOG_PREFIX} stderr: ${text.slice(0, 300)}`);
        }
      });

      proc.on("close", (code) => {
        const elapsed = (performance.now() - t0).toFixed(0);
        console.log(
          `${LOG_PREFIX} === DONE === code=${code} elapsed=${elapsed}ms`,
        );
        flushActiveTools();
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      proc.on("error", (err) => {
        console.error(`${LOG_PREFIX} Process error: ${err.message}`);
        send({ error: err.message });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });
    },
  });
}
