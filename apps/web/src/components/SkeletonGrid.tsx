import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@nasty-plot/ui"

interface SkeletonGridProps {
  count: number
  columns?: string
  className?: string
  children?: (index: number) => React.ReactNode
}

export function SkeletonGrid({ count, columns, className, children }: SkeletonGridProps) {
  const defaultChild = (i: number) => (
    <div key={i} className="rounded-lg border p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
    </div>
  )

  return (
    <div className={cn("grid gap-4", columns, className)}>
      {Array.from({ length: count }).map((_, i) => (children ?? defaultChild)(i))}
    </div>
  )
}
