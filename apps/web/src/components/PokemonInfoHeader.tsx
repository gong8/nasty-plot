import { PokemonSprite, TypeBadge } from "@nasty-plot/ui"
import type { PokemonType, PokemonSpecies } from "@nasty-plot/core"

interface PokemonInfoHeaderProps {
  pokemonId: string
  speciesData?: PokemonSpecies | null
  spriteSize?: number
  className?: string
}

export function PokemonInfoHeader({
  pokemonId,
  speciesData,
  spriteSize = 40,
  className,
}: PokemonInfoHeaderProps) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <PokemonSprite pokemonId={pokemonId} size={spriteSize} />
      <div>
        <div className="font-semibold">{speciesData?.name ?? pokemonId}</div>
        <div className="flex gap-1 mt-0.5">
          {speciesData?.types?.map((t: PokemonType) => (
            <TypeBadge key={t} type={t} size="sm" />
          ))}
        </div>
      </div>
    </div>
  )
}
