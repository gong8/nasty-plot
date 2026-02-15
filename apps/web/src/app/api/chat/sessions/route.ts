import { NextRequest } from "next/server"
import { createSession, listSessions } from "@nasty-plot/llm"
import { internalErrorResponse } from "../../../../lib/api-error"
import { validateBody, validateSearchParams } from "../../../../lib/validation"
import {
  chatSessionCreateSchema,
  chatSessionListSearchSchema,
} from "../../../../lib/schemas/chat.schemas"

export async function GET(req: NextRequest) {
  try {
    const [params, error] = validateSearchParams(req.url, chatSessionListSearchSchema)
    if (error) return error

    const { sessions, total } = await listSessions(params.teamId, params.contextMode, {
      page: params.page,
      pageSize: params.pageSize,
    })
    return Response.json({ data: sessions, total, page: params.page, pageSize: params.pageSize })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const [body, error] = await validateBody(req, chatSessionCreateSchema)
    if (error) return error

    const session = await createSession({
      teamId: body.teamId,
      contextMode: body.contextMode,
      contextData: body.contextData,
    })
    return Response.json({ data: session }, { status: 201 })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
