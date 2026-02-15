import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@nasty-plot/ui"

interface SkeletonListProps {
  count?: number
  height?: string
  className?: string
  layout?: "vertical" | "grid-2"
}

export function SkeletonList({
  count = 3,
  height = "h-12",
  className,
  layout = "vertical",
}: SkeletonListProps) {
  return (
    <div
      className={cn(
        layout === "vertical" && "space-y-2",
        layout === "grid-2" && "grid grid-cols-1 md:grid-cols-2 gap-3",
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn(height, "w-full")} />
      ))}
    </div>
  )
}
