import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonGrid } from "@/components/SkeletonGrid"

export default function PokemonLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b h-16" />
      <main className="flex-1 container mx-auto px-4 py-6">
        <Skeleton className="h-9 w-48 mb-6" />
        <div className="flex flex-wrap gap-4 mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
        <SkeletonGrid count={20} columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {(i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <Skeleton className="w-20 h-20 rounded-md" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          )}
        </SkeletonGrid>
      </main>
    </div>
  )
}
