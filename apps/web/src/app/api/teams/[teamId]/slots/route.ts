import { NextResponse } from "next/server"
import { addSlot } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { validateBody } from "../../../../../lib/validation"
import { teamSlotSchema } from "../../../../../lib/schemas/team.schemas"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const [body, error] = await validateBody(request, teamSlotSchema)
    if (error) return error

    const slot = await addSlot(teamId, body)
    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, {
      clientErrorPatterns: ["Team already has 6 slots", "Duplicate move"],
    })
  }
}
