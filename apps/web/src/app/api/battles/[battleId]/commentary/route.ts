import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params

  try {
    const { turn, text } = await req.json()

    if (typeof turn !== "number" || typeof text !== "string") {
      return NextResponse.json({ error: "Invalid turn or text" }, { status: 400 })
    }

    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      select: { commentary: true },
    })

    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 })
    }

    const existing: Record<string, string> = battle.commentary ? JSON.parse(battle.commentary) : {}

    existing[String(turn)] = text

    const updated = await prisma.battle.update({
      where: { id: battleId },
      data: { commentary: JSON.stringify(existing) },
      select: { commentary: true },
    })

    return NextResponse.json({
      commentary: JSON.parse(updated.commentary!),
    })
  } catch (err) {
    console.error("[PUT /api/battles/commentary]", err)
    return NextResponse.json({ error: "Failed to save commentary" }, { status: 500 })
  }
}
