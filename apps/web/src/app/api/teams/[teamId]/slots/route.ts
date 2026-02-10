import { NextResponse } from "next/server"
import { addSlot } from "@nasty-plot/teams"
import type { TeamSlotInput } from "@nasty-plot/core"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const body: TeamSlotInput = await request.json()
    const slot = await addSlot(teamId, body)
    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status =
      message === "Team already has 6 slots" || message.startsWith("Duplicate move") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
