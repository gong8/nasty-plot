import { NextRequest } from "next/server"
import { createSession, listSessions } from "@nasty-plot/llm"
import { loggedApiErrorResponse, INTERNAL_ERROR_OPTIONS } from "../../../../lib/api-error"

export async function GET(req: NextRequest) {
  try {
    const teamId = req.nextUrl.searchParams.get("teamId") ?? undefined
    const contextMode = req.nextUrl.searchParams.get("contextMode") ?? undefined
    const sessions = await listSessions(teamId, contextMode)
    return Response.json({ data: sessions })
  } catch (error) {
    return loggedApiErrorResponse("List sessions error:", error, INTERNAL_ERROR_OPTIONS)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      teamId,
      contextMode,
      contextData,
    }: { teamId?: string; contextMode?: string; contextData?: string } = body
    const session = await createSession({ teamId, contextMode, contextData })
    return Response.json({ data: session }, { status: 201 })
  } catch (error) {
    return loggedApiErrorResponse("Create session error:", error, INTERNAL_ERROR_OPTIONS)
  }
}
