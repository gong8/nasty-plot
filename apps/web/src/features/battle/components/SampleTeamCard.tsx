"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Swords } from "lucide-react"
import { PokemonSprite } from "@nasty-plot/ui"

interface SampleTeamCardProps {
  name: string
  pokemonIds: string
  archetype: string | null
  source: string | null
  paste: string
  onUse: (paste: string) => void
}

export function SampleTeamCard({
  name,
  pokemonIds,
  archetype,
  source,
  paste,
  onUse,
}: SampleTeamCardProps) {
  const ids = pokemonIds.split(",").filter(Boolean)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{name}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {archetype && (
              <Badge variant="secondary" className="text-xs">
                {archetype}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1 justify-center flex-wrap">
          {ids.map((id) => (
            <PokemonSprite key={id} pokemonId={id} size={48} />
          ))}
        </div>

        <div className="flex items-center justify-between">
          {source && <span className="text-xs text-muted-foreground">{source}</span>}
          {!source && <span />}
          <Button size="sm" className="gap-1.5" onClick={() => onUse(paste)}>
            <Swords className="h-3.5 w-3.5" />
            Use in Battle
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
