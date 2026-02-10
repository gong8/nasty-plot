import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSpecies, getLearnset, getMove } from "@nasty-plot/pokemon-data";
import { prisma } from "@nasty-plot/db";
import { getSetsForPokemon } from "@nasty-plot/smogon-data";
import { SiteHeader } from "@/components/site-header";
import { StatBar } from "@nasty-plot/ui";
import { TypeBadge } from "@nasty-plot/ui";
import { CompetitiveData } from "./competitive-data";
import { STATS } from "@nasty-plot/core";
import type { MoveData, StatName, UsageStatsEntry } from "@nasty-plot/core";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PokemonDetailPage({ params }: Props) {
  const { id } = await params;
  const species = getSpecies(id);

  if (!species) {
    notFound();
  }

  const moveIds = await getLearnset(id);
  const moves: MoveData[] = [];
  for (const moveId of moveIds) {
    const move = getMove(moveId);
    if (move) moves.push(move);
  }
  moves.sort((a, b) => a.name.localeCompare(b.name));

  const bst = STATS.reduce((sum, stat) => sum + species.baseStats[stat], 0);
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species.num}.png`;

  // Fetch competitive data from DB (non-blocking, graceful on empty DB)
  const formats = await prisma.format.findMany({ where: { isActive: true } }).catch(() => []);

  const usageByFormat = await Promise.all(
    formats.map(async (f: { id: string; name: string }) => {
      const row = await prisma.usageStats
        .findFirst({ where: { formatId: f.id, pokemonId: id }, orderBy: { year: "desc" } })
        .catch(() => null);
      const stats: UsageStatsEntry | null = row
        ? { pokemonId: row.pokemonId, usagePercent: row.usagePercent, rank: row.rank }
        : null;
      return { formatId: f.id, formatName: f.name, stats };
    })
  );

  const setsByFormat = await Promise.all(
    formats.map(async (f: { id: string; name: string }) => {
      const sets = await getSetsForPokemon(f.id, id).catch(() => []);
      return { formatId: f.id, formatName: f.name, sets };
    })
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

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
                      {slot === "H" && (
                        <span className="text-muted-foreground ml-2">(Hidden)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Competitive Data: Usage stats + Smogon sets */}
        <div className="mt-6">
          <CompetitiveData
            pokemonId={id}
            usageByFormat={usageByFormat}
            setsByFormat={setsByFormat}
          />
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
                        className={`text-xs font-medium ${
                          move.category === "Physical"
                            ? "text-red-500"
                            : move.category === "Special"
                            ? "text-blue-500"
                            : "text-gray-500"
                        }`}
                      >
                        {move.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {move.basePower || "-"}
                    </TableCell>
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
  );
}
