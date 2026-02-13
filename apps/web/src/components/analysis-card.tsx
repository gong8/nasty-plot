import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SkeletonList } from "@/components/skeleton-list"
import type { ReactNode } from "react"

interface AnalysisCardProps {
  title: string
  icon?: ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  skeletonCount?: number
  skeletonHeight?: string
  skeletonLayout?: "vertical" | "grid-2"
  children?: ReactNode
}

export function AnalysisCard({
  title,
  icon,
  isLoading,
  isEmpty,
  emptyMessage = "No data available.",
  skeletonCount = 3,
  skeletonHeight = "h-12",
  skeletonLayout = "vertical",
  children,
}: AnalysisCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonList count={skeletonCount} height={skeletonHeight} layout={skeletonLayout} />
        </CardContent>
      </Card>
    )
  }

  if (isEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
