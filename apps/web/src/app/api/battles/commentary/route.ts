import { NextRequest } from "next/server"
import { apiErrorResponse, badRequestResponse } from "../../../../lib/api-error"
import type { BattleState, BattleLogEntry } from "@nasty-plot/battle-engine"
import {
  buildTurnCommentaryContext,
  buildPostBattleContext,
  buildTurnAnalysisContext,
  getOpenAI,
  MODEL,
} from "@nasty-plot/llm"

const DEFAULT_SYSTEM_PROMPT = "You are an expert Pokemon competitive battle commentator."

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      mode,
      state,
      recentEntries,
      allEntries,
      turnEntries,
      prevTurnEntries,
      team1Name,
      team2Name,
      winner,
      totalTurns,
    } = body

    const playerName = team1Name || "Player"
    const opponentName = team2Name || "Opponent"

    const prompts = buildPrompts(mode, {
      state,
      recentEntries,
      allEntries,
      turnEntries,
      prevTurnEntries,
      playerName,
      opponentName,
      winner,
      totalTurns,
    })

    if (!prompts) {
      return badRequestResponse("Invalid mode or missing data")
    }

    const openai = getOpenAI()
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user },
      ],
      stream: true,
      max_tokens: 300,
      temperature: 0.7,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Commentary failed" })
  }
}

type CommentaryData = {
  state?: BattleState
  recentEntries?: BattleLogEntry[]
  allEntries?: BattleLogEntry[]
  turnEntries?: BattleLogEntry[]
  prevTurnEntries?: BattleLogEntry[]
  playerName: string
  opponentName: string
  winner?: string | null
  totalTurns?: number
}

function buildPrompts(mode: string, data: CommentaryData): { system: string; user: string } | null {
  if (mode === "turn" && data.state && data.recentEntries) {
    const ctx = buildTurnCommentaryContext(
      data.state,
      data.recentEntries,
      data.playerName,
      data.opponentName,
    )
    return { system: ctx.systemPrompt, user: ctx.turnContext }
  }

  if (mode === "post-battle" && data.allEntries) {
    return {
      system: DEFAULT_SYSTEM_PROMPT,
      user: buildPostBattleContext(
        data.allEntries,
        data.playerName,
        data.opponentName,
        data.winner ?? null,
        data.totalTurns || 0,
      ),
    }
  }

  if (mode === "turn-analysis" && data.state && data.turnEntries) {
    return {
      system: DEFAULT_SYSTEM_PROMPT,
      user: buildTurnAnalysisContext(data.state, data.turnEntries, data.prevTurnEntries),
    }
  }

  return null
}
