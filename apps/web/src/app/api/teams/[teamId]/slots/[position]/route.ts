import { NextResponse } from "next/server";
import {
  updateSlot,
  removeSlot,
} from "@nasty-plot/teams";

function parsePosition(position: string): number | null {
  const pos = parseInt(position, 10);
  if (isNaN(pos) || pos < 1 || pos > 6) return null;
  return pos;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamId: string; position: string }> }
) {
  try {
    const { teamId, position } = await params;
    const pos = parsePosition(position);
    if (pos === null) {
      return NextResponse.json(
        { error: "Invalid position" },
        { status: 400 }
      );
    }
    const body = await request.json();
    const slot = await updateSlot(teamId, pos, body);
    return NextResponse.json(slot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; position: string }> }
) {
  try {
    const { teamId, position } = await params;
    const pos = parsePosition(position);
    if (pos === null) {
      return NextResponse.json(
        { error: "Invalid position" },
        { status: 400 }
      );
    }
    await removeSlot(teamId, pos);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
