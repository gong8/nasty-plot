import { NextResponse } from "next/server";
import { getSampleTeam, deleteSampleTeam } from "@nasty-plot/teams";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const team = await getSampleTeam(id);
    if (!team) {
      return NextResponse.json(
        { error: "Sample team not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(team);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteSampleTeam(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
