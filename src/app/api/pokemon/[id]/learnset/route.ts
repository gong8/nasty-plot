import { NextResponse } from "next/server";
import { getSpecies, getLearnset, getMove } from "@/modules/pokemon-data";
import type { ApiResponse, MoveData } from "@/shared/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const species = getSpecies(id);

  if (!species) {
    return NextResponse.json(
      { error: "Pokemon not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const moveIds = await getLearnset(id);
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
