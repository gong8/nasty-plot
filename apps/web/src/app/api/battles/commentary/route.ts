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
import { validateBody } from "../../../../lib/validation"
import { battleCommentarySchema } from "../../../../lib/schemas/battle.schemas"

const DEFAULT_SYSTEM_PROMPT = "You are an expert Pokemon competitive battle commentator."

export async function POST(req: NextRequest) {
  try {
    const [body, error] = await validateBody(req, battleCommentarySchema)
    if (error) return error

    const playerName = body.team1Name || "Player"
    const opponentName = body.team2Name || "Opponent"

    const prompts = buildPrompts(body.mode, {
      state: body.state as BattleState | undefined,
      recentEntries: body.recentEntries as BattleLogEntry[] | undefined,
      allEntries: body.allEntries as BattleLogEntry[] | undefined,
      turnEntries: body.turnEntries as BattleLogEntry[] | undefined,
      prevTurnEntries: body.prevTurnEntries as BattleLogEntry[] | undefined,
      playerName,
      opponentName,
      winner: body.winner,
      totalTurns: body.totalTurns,
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
        } catch (err) {
          controller.error(err)
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
  } catch (err) {
    return apiErrorResponse(err, { fallback: "Commentary failed" })
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
