import { NextResponse } from "next/server"
import {
  getMoveUsage,
  getItemUsage,
  getAbilityUsage,
  getNatureUsage,
} from "@nasty-plot/smogon-data"
import { badRequestResponse } from "../../../../../lib/api-error"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const { searchParams } = new URL(request.url)
  const formatId = searchParams.get("formatId")

  if (!formatId) {
    return badRequestResponse("format query param is required")
  }

  const [moves, items, abilities, natures] = await Promise.all([
    getMoveUsage(formatId, pokemonId),
    getItemUsage(formatId, pokemonId),
    getAbilityUsage(formatId, pokemonId),
    getNatureUsage(formatId, pokemonId),
  ])

  return NextResponse.json({
    data: {
      moves: moves.map((move) => ({ name: move.moveName, usagePercent: move.usagePercent })),
      items: items.map((item) => ({ name: item.itemName, usagePercent: item.usagePercent })),
      abilities: abilities.map((ability) => ({
        name: ability.abilityName,
        usagePercent: ability.usagePercent,
      })),
      natures: natures.map((nature) => ({ name: nature.natureName, count: nature.count })),
    },
  })
}
