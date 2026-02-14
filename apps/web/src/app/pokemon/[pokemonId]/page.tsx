import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSpecies, getLearnset, getMove } from "@nasty-plot/pokemon-data"
import { getSetsForPokemon } from "@nasty-plot/smogon-data"
import { StatBar, TypeBadge } from "@nasty-plot/ui"
import { CompetitiveData } from "./competitive-data"
import { getActiveFormatsFromDb, getUsageByFormat } from "./actions"
import { STATS, getBaseStatTotal, type MoveData, type StatName } from "@nasty-plot/core"

const CATEGORY_COLORS: Record<string, string> = {
  Physical: "text-red-500",
  Special: "text-blue-500",
  Status: "text-gray-500",
}

interface Props {
  params: Promise<{ pokemonId: string }>
}

export default async function PokemonDetailPage({ params }: Props) {
  const { pokemonId } = await params
  const species = getSpecies(pokemonId)

  if (!species) {
    notFound()
  }

  const moveIds = await getLearnset(pokemonId)
  const moves = moveIds
    .map(getMove)
    .filter((m): m is MoveData => m != null)
    .sort((a, b) => a.name.localeCompare(b.name))

  const bst = getBaseStatTotal(species.baseStats)
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species.num}.png`

  // Fetch competitive data from DB (non-blocking, graceful on empty DB)
  const formats = await getActiveFormatsFromDb()
  const usageByFormat = await getUsageByFormat(formats, pokemonId)

  const setsByFormat = await Promise.all(
    formats.map(async (f) => {
      const sets = await getSetsForPokemon(f.id, pokemonId).catch(() => [])
      return { formatId: f.id, formatName: f.name, sets }
    }),
  )

  return (
    <div className="flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-6">
        <Link href="/pokemon">
          <Button variant="ghost" size="sm" className="gap-1 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Pokemon
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Sprite + basic info */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={spriteUrl}
                alt={species.name}
                width={160}
                height={160}
                className="pixelated"
              />
              <h1 className="text-2xl font-bold">{species.name}</h1>
              <span className="text-sm text-muted-foreground">#{species.num}</span>
              <div className="flex gap-2">
                {species.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </div>
              {species.tier && (
                <span className="text-xs text-muted-foreground">Tier: {species.tier}</span>
              )}
            </CardContent>
          </Card>

          {/* Right column: Stats + Abilities */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Base Stats (Total: {bst})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {STATS.map((stat) => (
                  <StatBar
                    key={stat}
                    stat={stat as StatName}
                    value={species.baseStats[stat as StatName]}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Abilities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {Object.entries(species.abilities).map(([slot, name]) => (
                    <li key={slot} className="text-sm">
                      <span className="font-medium">{name}</span>
                      {slot === "H" && <span className="text-muted-foreground ml-2">(Hidden)</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Competitive Data: Usage stats + Smogon sets */}
        <div className="mt-6">
          <CompetitiveData usageByFormat={usageByFormat} setsByFormat={setsByFormat} />
        </div>

        {/* Learnset table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Learnset ({moves.length} moves)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Move</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Power</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">PP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moves.map((move) => (
                  <TableRow key={move.id}>
                    <TableCell className="font-medium">{move.name}</TableCell>
                    <TableCell>
                      <TypeBadge type={move.type} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-medium ${CATEGORY_COLORS[move.category] ?? "text-gray-500"}`}
                      >
                        {move.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{move.basePower || "-"}</TableCell>
                    <TableCell className="text-right">
                      {move.accuracy === true ? "-" : `${move.accuracy}%`}
                    </TableCell>
                    <TableCell className="text-right">{move.pp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
