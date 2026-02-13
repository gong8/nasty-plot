import { NextRequest } from "next/server"
import { getSession, updateSession, deleteSession } from "@nasty-plot/llm"
import { apiErrorResponse, notFoundResponse } from "../../../../../lib/api-error"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(id)

    if (!session) {
      return notFoundResponse("Session")
    }

    return Response.json({ data: session })
  } catch (error) {
    console.error("Get session error:", error)
    return apiErrorResponse(error, { fallback: "Internal server error", code: "INTERNAL_ERROR" })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title }: { title?: string } = body

    const session = await updateSession(id, { title })
    if (!session) {
      return notFoundResponse("Session")
    }

    return Response.json({ data: session })
  } catch (error) {
    console.error("Update session error:", error)
    return apiErrorResponse(error, { fallback: "Internal server error", code: "INTERNAL_ERROR" })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteSession(id)
    return Response.json({ success: true })
  } catch (error) {
    console.error("Delete session error:", error)
    return apiErrorResponse(error, { fallback: "Internal server error", code: "INTERNAL_ERROR" })
  }
}
