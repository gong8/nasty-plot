import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonGrid } from "@/components/SkeletonGrid"

export default function ChatLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b h-16" />
      <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-44" />
        </div>
        <SkeletonGrid count={4} columns="" className="flex-1">
          {(i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
              <Skeleton className={`h-16 rounded-lg ${i % 2 === 0 ? "w-3/4" : "w-1/2"}`} />
            </div>
          )}
        </SkeletonGrid>
        <Skeleton className="h-12 w-full mt-4" />
      </div>
    </div>
  )
}
