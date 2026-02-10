import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { turns: { orderBy: { turnNumber: "asc" } } },
  })

  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 })
  }

  return NextResponse.json(battle)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params
  try {
    await prisma.battle.delete({ where: { id: battleId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 })
  }
}
