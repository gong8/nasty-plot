import { NextRequest, NextResponse } from "next/server"
import {
  buildTurnCommentaryContext,
  buildPostBattleContext,
  buildTurnAnalysisContext,
  getOpenAI,
  MODEL,
} from "@nasty-plot/llm"

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

    let systemPrompt = "You are an expert Pokemon competitive battle commentator."
    let userPrompt = ""

    if (mode === "turn" && state && recentEntries) {
      const ctx = buildTurnCommentaryContext(
        state,
        recentEntries,
        team1Name || "Player",
        team2Name || "Opponent",
      )
      systemPrompt = ctx.systemPrompt
      userPrompt = ctx.turnContext
    } else if (mode === "post-battle" && allEntries) {
      userPrompt = buildPostBattleContext(
        allEntries,
        team1Name || "Player",
        team2Name || "Opponent",
        winner,
        totalTurns || 0,
      )
    } else if (mode === "turn-analysis" && state && turnEntries) {
      userPrompt = buildTurnAnalysisContext(state, turnEntries, prevTurnEntries)
    } else {
      return NextResponse.json({ error: "Invalid mode or missing data" }, { status: 400 })
    }

    const openai = getOpenAI()
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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
    console.error("[Commentary API]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Commentary failed" },
      { status: 500 },
    )
  }
}
