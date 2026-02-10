import type OpenAI from "openai";
import { getOpenAI, MODEL } from "./openai-client";
import { buildTeamContext, buildMetaContext } from "./context-builder";
import { getMcpTools, executeMcpTool, getMcpResourceContext } from "./mcp-client";
import type { ChatMessage, TeamData, UsageStatsEntry } from "@nasty-plot/core";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SYSTEM_PROMPT = `You are a competitive Pokemon expert assistant for Scarlet/Violet (Gen 9). You help trainers build, analyse, and optimize their teams.

Your areas of expertise:
- Team building: suggesting Pokemon, movesets, EV spreads, items, and abilities
- Competitive meta knowledge: usage trends, tier viability, common cores
- Damage calculations and speed tiers
- Type matchups and coverage analysis
- Threat identification and counterplay

Be concise but thorough. When suggesting sets, include the full spread (EVs, nature, item, ability, 4 moves). Use standard competitive notation. When discussing damage, reference specific calcs when possible.

You have access to tools for looking up Pokemon data, usage stats, and performing calculations. Use them when the user asks specific questions rather than guessing.`;

interface StreamChatOptions {
  messages: ChatMessage[];
  teamId?: string;
  formatId?: string;
}

export async function streamChat(
  options: StreamChatOptions,
): Promise<ReadableStream<Uint8Array>> {
  const { messages, teamId, formatId } = options;
  const encoder = new TextEncoder();

  const systemParts = [SYSTEM_PROMPT];

  // Inject MCP resource context (type chart, formats, natures, stat formulas)
  const resourceContext = await getMcpResourceContext();
  if (resourceContext) {
    systemParts.push(resourceContext);
  }

  if (teamId) {
    try {
      const res = await fetch(`${BASE_URL}/api/teams/${teamId}`);
      if (res.ok) {
        const teamData = (await res.json()) as { data: TeamData };
        systemParts.push("\n" + buildTeamContext(teamData.data));
      }
    } catch {
      // Team context is optional
    }
  }

  if (formatId) {
    try {
      const res = await fetch(
        `${BASE_URL}/api/formats/${formatId}/usage?limit=20`,
      );
      if (res.ok) {
        const usageData = (await res.json()) as { data: UsageStatsEntry[] };
        systemParts.push(
          "\n" + buildMetaContext(formatId, usageData.data),
        );
      }
    } catch {
      // Meta context is optional
    }
  }

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemParts.join("\n") },
    ...messages.map(
      (m): OpenAI.ChatCompletionMessageParam => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    ),
  ];

  return new ReadableStream({
    async start(controller) {
      try {
        await processStream(controller, encoder, openaiMessages);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorMsg })}\n\n`,
          ),
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

function sendEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  data: Record<string, unknown>,
): void {
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
  );
}

async function processStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<void> {
  const currentMessages = [...messages];
  const maxToolRounds = 5;

  // Discover tools from MCP server (empty array if unavailable)
  const tools = await getMcpTools();

  for (let round = 0; round < maxToolRounds; round++) {
    const createOptions: OpenAI.ChatCompletionCreateParamsStreaming = {
      model: MODEL,
      messages: currentMessages,
      stream: true,
    };

    // Only pass tools if we have them
    if (tools.length > 0) {
      createOptions.tools = tools;
    }

    const stream = await getOpenAI().chat.completions.create(createOptions);

    let hasToolCalls = false;
    const toolCalls = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();
    let contentBuffer = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        contentBuffer += delta.content;
        sendEvent(controller, encoder, { content: delta.content });
      }

      if (delta.tool_calls) {
        hasToolCalls = true;
        for (const tc of delta.tool_calls) {
          const existing = toolCalls.get(tc.index);
          if (existing) {
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
            }
          } else {
            toolCalls.set(tc.index, {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            });
          }
        }
      }
    }

    if (!hasToolCalls) {
      break;
    }

    const assistantMsg: OpenAI.ChatCompletionMessageParam = {
      role: "assistant",
      content: contentBuffer || null,
      tool_calls: Array.from(toolCalls.values()).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
    currentMessages.push(assistantMsg);

    for (const tc of toolCalls.values()) {
      sendEvent(controller, encoder, {
        toolCall: { name: tc.name, status: "executing" },
      });

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.arguments);
      } catch {
        args = {};
      }

      const result = await executeMcpTool(tc.name, args);

      sendEvent(controller, encoder, {
        toolCall: { name: tc.name, status: "complete" },
      });

      currentMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }
}
