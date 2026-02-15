import { PokemonSprite } from "@nasty-plot/ui"

interface PokemonSpriteRowProps {
  pokemonIds: string[]
  size?: number
  className?: string
}

export function PokemonSpriteRow({ pokemonIds, size = 32, className }: PokemonSpriteRowProps) {
  return (
    <div className={`flex gap-1 ${className ?? ""}`}>
      {pokemonIds.map((id) => (
        <PokemonSprite key={id} pokemonId={id} size={size} />
      ))}
    </div>
  )
}
