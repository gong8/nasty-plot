import { NextResponse } from "next/server";
import { createTeam, listTeams } from "@/modules/teams/services/team.service";
import type { TeamCreateInput } from "@/shared/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const formatId = searchParams.get("formatId") || undefined;
    const teams = await listTeams(formatId ? { formatId } : undefined);
    return NextResponse.json(teams);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: TeamCreateInput = await request.json();
    if (!body.name || !body.formatId) {
      return NextResponse.json(
        { error: "name and formatId are required" },
        { status: 400 }
      );
    }
    const team = await createTeam(body);
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
