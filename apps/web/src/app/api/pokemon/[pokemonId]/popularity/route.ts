import { NextResponse } from "next/server"
import {
  getMoveUsage,
  getItemUsage,
  getAbilityUsage,
  getNatureUsage,
} from "@nasty-plot/smogon-data"
import { validateSearchParams } from "../../../../../lib/validation"
import { pokemonPopularitySearchSchema } from "../../../../../lib/schemas/pokemon.schemas"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const [searchParams, error] = validateSearchParams(request.url, pokemonPopularitySearchSchema)
  if (error) return error

  const [moves, items, abilities, natures] = await Promise.all([
    getMoveUsage(searchParams.formatId, pokemonId),
    getItemUsage(searchParams.formatId, pokemonId),
    getAbilityUsage(searchParams.formatId, pokemonId),
    getNatureUsage(searchParams.formatId, pokemonId),
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
