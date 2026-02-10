import { NextResponse } from "next/server";
import { createTeam, listTeams } from "@nasty-plot/teams";
import type { TeamCreateInput } from "@nasty-plot/core";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const formatId = searchParams.get("formatId") || undefined;
    const includeArchived = searchParams.get("includeArchived");
    const teams = await listTeams({
      formatId,
      includeArchived: includeArchived === "true",
    });
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
