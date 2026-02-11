import { NextResponse } from "next/server"
import {
  getMoveUsage,
  getItemUsage,
  getAbilityUsage,
  getNatureUsage,
} from "@nasty-plot/smogon-data"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: pokemonId } = await params
  const { searchParams } = new URL(request.url)
  const formatId = searchParams.get("format")

  if (!formatId) {
    return NextResponse.json({ error: "format query param is required" }, { status: 400 })
  }

  const [moves, items, abilities, natures] = await Promise.all([
    getMoveUsage(formatId, pokemonId),
    getItemUsage(formatId, pokemonId),
    getAbilityUsage(formatId, pokemonId),
    getNatureUsage(formatId, pokemonId),
  ])

  return NextResponse.json({
    data: {
      moves: moves.map((m) => ({ name: m.moveName, usagePercent: m.usagePercent })),
      items: items.map((i) => ({ name: i.itemName, usagePercent: i.usagePercent })),
      abilities: abilities.map((a) => ({ name: a.abilityName, usagePercent: a.usagePercent })),
      natures: natures.map((n) => ({ name: n.natureName, count: n.count })),
    },
  })
}
