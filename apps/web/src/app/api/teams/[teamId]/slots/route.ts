import { NextResponse } from "next/server"
import { addSlot } from "@nasty-plot/teams"
import type { TeamSlotInput } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../../../lib/api-error"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const body: TeamSlotInput = await request.json()
    const slot = await addSlot(teamId, body)
    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, {
      clientErrorPatterns: ["Team already has 6 slots", "Duplicate move"],
    })
  }
}
