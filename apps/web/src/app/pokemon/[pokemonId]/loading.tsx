import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonGrid } from "@/components/skeleton-grid"

export default function PokemonDetailLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b h-16" />
      <main className="flex-1 container mx-auto px-4 py-6">
        <Skeleton className="h-4 w-32 mb-4" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <Skeleton className="w-40 h-40 rounded-md" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-4 w-16" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <SkeletonGrid count={6} columns="" className="space-y-2 gap-0">
                  {(i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  )}
                </SkeletonGrid>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <SkeletonGrid count={10} columns="" className="space-y-3 gap-0">
              {(i) => <Skeleton key={i} className="h-8 w-full" />}
            </SkeletonGrid>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
