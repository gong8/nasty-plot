import { NextResponse } from "next/server";
import { exportShowdownPaste } from "@/modules/teams/services/import-export.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const paste = await exportShowdownPaste(teamId);
    return new NextResponse(paste, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Team not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
