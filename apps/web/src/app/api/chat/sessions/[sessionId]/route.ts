import { NextRequest } from "next/server"
import { getSession, updateSession, deleteSession } from "@nasty-plot/llm"
import { apiErrorResponse, notFoundResponse } from "../../../../../lib/api-error"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params
    const session = await getSession(sessionId)

    if (!session) {
      return notFoundResponse("Session")
    }

    return Response.json({ data: session })
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Internal server error", code: "INTERNAL_ERROR" })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params
    const body = await req.json()
    const { title }: { title?: string } = body

    const session = await updateSession(sessionId, { title })
    if (!session) {
      return notFoundResponse("Session")
    }

    return Response.json({ data: session })
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Internal server error", code: "INTERNAL_ERROR" })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params
    await deleteSession(sessionId)
    return Response.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Internal server error", code: "INTERNAL_ERROR" })
  }
}
