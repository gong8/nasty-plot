import { NextRequest } from "next/server"
import { createSession, listSessions } from "@nasty-plot/llm"

export async function GET(req: NextRequest) {
  try {
    const teamId = req.nextUrl.searchParams.get("teamId") ?? undefined
    const sessions = await listSessions(teamId)
    return Response.json({ data: sessions })
  } catch (error) {
    console.error("List sessions error:", error)
    return Response.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { teamId }: { teamId?: string } = body
    const session = await createSession(teamId)
    return Response.json({ data: session }, { status: 201 })
  } catch (error) {
    console.error("Create session error:", error)
    return Response.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    )
  }
}
