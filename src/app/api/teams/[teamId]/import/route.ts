import { NextResponse } from "next/server";
import { importShowdownPaste } from "@/modules/teams/services/import-export.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId: _teamId } = await params;
    const body = await request.json();
    if (!body.paste) {
      return NextResponse.json(
        { error: "paste is required" },
        { status: 400 }
      );
    }
    const team = await importShowdownPaste(
      body.paste,
      body.formatId || "gen9ou",
      body.teamName
    );
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
