import { NextResponse } from "next/server"
import { updateSlot, removeSlot } from "@nasty-plot/teams"
import { apiErrorResponse, badRequestResponse } from "../../../../../../lib/api-error"

function parsePosition(position: string): number | null {
  const pos = parseInt(position, 10)
  if (isNaN(pos) || pos < 1 || pos > 6) return null
  return pos
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamId: string; position: string }> },
) {
  try {
    const { teamId, position } = await params
    const pos = parsePosition(position)
    if (pos === null) {
      return badRequestResponse("Invalid position")
    }
    const body = await request.json()
    const slot = await updateSlot(teamId, pos, body)
    return NextResponse.json(slot)
  } catch (error) {
    return apiErrorResponse(error, { clientErrorPatterns: ["Duplicate move"] })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; position: string }> },
) {
  try {
    const { teamId, position } = await params
    const pos = parsePosition(position)
    if (pos === null) {
      return badRequestResponse("Invalid position")
    }
    await removeSlot(teamId, pos)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
