import { NextResponse } from "next/server"
import { exportShowdownPaste } from "@nasty-plot/teams"
import { entityErrorResponse } from "../../../../../lib/api-error"

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const paste = await exportShowdownPaste(teamId)
    return new NextResponse(paste, {
      headers: { "Content-Type": "text/plain" },
    })
  } catch (error) {
    return entityErrorResponse(error)
  }
}
