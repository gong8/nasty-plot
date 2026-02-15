import { NextRequest } from "next/server"
import { getSession, updateSession, deleteSession } from "@nasty-plot/llm"
import { internalErrorResponse, notFoundResponse } from "../../../../../lib/api-error"
import { validateBody } from "../../../../../lib/validation"
import { chatSessionUpdateSchema } from "../../../../../lib/schemas/chat.schemas"

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
    return internalErrorResponse(error)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params
    const [body, error] = await validateBody(req, chatSessionUpdateSchema)
    if (error) return error

    const session = await updateSession(sessionId, { title: body.title })
    if (!session) {
      return notFoundResponse("Session")
    }

    return Response.json({ data: session })
  } catch (error) {
    return internalErrorResponse(error)
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
    return internalErrorResponse(error)
  }
}
