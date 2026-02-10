import type OpenAI from "openai";
import { getOpenAI, MODEL } from "./openai-client";
import { buildTeamContext, buildMetaContext } from "./context-builder";
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

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_pokemon",
      description:
        "Search for a Pokemon by name and get its stats, types, and abilities",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_usage_stats",
      description:
        "Get usage statistics for a format showing the most popular Pokemon",
      parameters: {
        type: "object",
        properties: {
          formatId: { type: "string" },
          limit: { type: "number" },
        },
        required: ["formatId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_damage",
      description:
        "Calculate damage from one Pokemon's move against another",
      parameters: {
        type: "object",
        properties: {
          attackerPokemon: { type: "string" },
          defenderPokemon: { type: "string" },
          moveName: { type: "string" },
          attackerLevel: { type: "number" },
          defenderLevel: { type: "number" },
        },
        required: ["attackerPokemon", "defenderPokemon", "moveName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_team",
      description:
        "Analyze a team's type coverage, weaknesses, and threats",
      parameters: {
        type: "object",
        properties: { teamId: { type: "string" } },
        required: ["teamId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_teammates",
      description:
        "Suggest Pokemon teammates based on current team composition",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string" },
          formatId: { type: "string" },
        },
        required: ["teamId", "formatId"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    let result: unknown;

    switch (name) {
      case "search_pokemon": {
        const res = await fetch(
          `${BASE_URL}/api/pokemon?search=${encodeURIComponent(args.query as string)}`,
        );
        result = await res.json();
        break;
      }
      case "get_usage_stats": {
        const limit = (args.limit as number) || 20;
        const res = await fetch(
          `${BASE_URL}/api/formats/${encodeURIComponent(args.formatId as string)}/usage?limit=${limit}`,
        );
        result = await res.json();
        break;
      }
      case "calculate_damage": {
        const res = await fetch(`${BASE_URL}/api/damage-calc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attacker: {
              pokemonId: args.attackerPokemon,
              level: (args.attackerLevel as number) || 100,
            },
            defender: {
              pokemonId: args.defenderPokemon,
              level: (args.defenderLevel as number) || 100,
            },
            move: args.moveName,
          }),
        });
        result = await res.json();
        break;
      }
      case "analyze_team": {
        const res = await fetch(
          `${BASE_URL}/api/teams/${encodeURIComponent(args.teamId as string)}/analysis`,
        );
        result = await res.json();
        break;
      }
      case "suggest_teammates": {
        const res = await fetch(`${BASE_URL}/api/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: args.teamId,
            formatId: args.formatId,
          }),
        });
        result = await res.json();
        break;
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      error: `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

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

  for (let round = 0; round < maxToolRounds; round++) {
    const stream = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: currentMessages,
      tools,
      stream: true,
    });

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

      const result = await executeTool(tc.name, args);

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
