"use client"

import { Shield, Swords, Zap, Gauge, TriangleAlert, Eraser } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, TypeBadge, PokemonSprite } from "@nasty-plot/ui"
import type { PokemonType, UsageStatsEntry } from "@nasty-plot/core"
import type { GuidedPokemonPick } from "../hooks/use-guided-builder"

interface RoleDefinition {
  id: string
  label: string
  description: string
  icon: string
}

interface RoleSelectorProps {
  role: RoleDefinition
  candidates: UsageStatsEntry[]
  selected: GuidedPokemonPick | null
  onSelect: (pokemon: GuidedPokemonPick | null) => void
  disabledIds: Set<string>
}

const TYPE_AFFINITY_BONUS = 10
const MAX_ROLE_CANDIDATES = 5

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  swords: Swords,
  zap: Zap,
  gauge: Gauge,
  "triangle-alert": TriangleAlert,
  eraser: Eraser,
}

const ROLE_TYPE_AFFINITY: Record<string, PokemonType[]> = {
  "physical-wall": ["Steel", "Ground", "Rock"],
  "special-wall": ["Fairy", "Water", "Psychic"],
  "physical-attacker": ["Fighting", "Ground", "Dragon"],
  "special-attacker": ["Fire", "Electric", "Psychic"],
  "speed-control": ["Electric", "Flying", "Dragon"],
  "hazard-setter": ["Ground", "Rock", "Steel"],
  "hazard-removal": ["Flying", "Normal", "Water"],
}

function filterForRole(
  candidates: UsageStatsEntry[],
  roleId: string,
  disabledIds: Set<string>,
): UsageStatsEntry[] {
  const available = candidates.filter((c) => !disabledIds.has(c.pokemonId))
  const preferredTypes = ROLE_TYPE_AFFINITY[roleId] ?? []

  const scored = available.map((c) => {
    const types: PokemonType[] = c.types ?? []
    const typeBonus = types.some((t) => preferredTypes.includes(t)) ? TYPE_AFFINITY_BONUS : 0
    return { ...c, score: typeBonus + c.usagePercent }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, MAX_ROLE_CANDIDATES)
}

export function RoleSelector({
  role,
  candidates,
  selected,
  onSelect,
  disabledIds,
}: RoleSelectorProps) {
  const Icon = ICON_MAP[role.icon] ?? Shield
  const filtered = filterForRole(candidates, role.id, disabledIds)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {role.label}
          {selected && (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              {selected.pokemonName}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{role.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {filtered.map((c) => {
            const name = c.pokemonName || c.pokemonId
            const types: PokemonType[] = c.types ?? ["Normal"]
            const isSelected = selected?.pokemonId === c.pokemonId

            return (
              <button
                key={c.pokemonId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-accent",
                )}
                onClick={() =>
                  onSelect(
                    isSelected
                      ? null
                      : {
                          pokemonId: c.pokemonId,
                          pokemonName: name,
                          types,
                          usagePercent: c.usagePercent,
                        },
                  )
                }
              >
                <PokemonSprite pokemonId={c.pokemonId} size={32} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{name}</span>
                  <div className="flex gap-0.5">
                    {types.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </div>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No suitable candidates available. Try selecting fewer core Pokemon.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
