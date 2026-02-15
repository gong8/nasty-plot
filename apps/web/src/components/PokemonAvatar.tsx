import { cn } from "@nasty-plot/ui"

interface PokemonAvatarProps {
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZES = {
  sm: "w-6 h-6 text-[9px]",
  md: "w-8 h-8 text-[10px]",
  lg: "w-9 h-9 text-xs font-medium",
}

export function PokemonAvatar({ name, size = "md", className }: PokemonAvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full bg-muted flex items-center justify-center shrink-0",
        SIZES[size],
        className,
      )}
    >
      {name.slice(0, 2)}
    </div>
  )
}
