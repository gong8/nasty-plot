import { NextResponse } from "next/server";
import { getSpecies, getLearnset, getMove } from "@nasty-plot/pokemon-data";
import { getFormatLearnset } from "@nasty-plot/formats";
import type { ApiResponse, MoveData } from "@nasty-plot/core";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const formatId = searchParams.get("format");

  const species = getSpecies(id);

  if (!species) {
    return NextResponse.json(
      { error: "Pokemon not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const moveIds = formatId
    ? await getFormatLearnset(id, formatId)
    : await getLearnset(id);
  const moves: MoveData[] = [];

  for (const moveId of moveIds) {
    const move = getMove(moveId);
    if (move) moves.push(move);
  }

  // Sort by name
  moves.sort((a, b) => a.name.localeCompare(b.name));

  const response: ApiResponse<MoveData[]> = { data: moves };
  return NextResponse.json(response);
}
