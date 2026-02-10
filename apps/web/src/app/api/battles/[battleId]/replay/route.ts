import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@nasty-plot/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params;
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    select: {
      id: true,
      formatId: true,
      gameType: true,
      team1Name: true,
      team2Name: true,
      winnerId: true,
      turnCount: true,
      protocolLog: true,
      commentary: true,
      createdAt: true,
      turns: { orderBy: { turnNumber: "asc" } },
    },
  });

  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }

  return NextResponse.json(battle);
}
