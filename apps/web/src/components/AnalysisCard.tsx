import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SkeletonList } from "@/components/SkeletonList"
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
  let body: ReactNode
  if (isLoading) {
    body = <SkeletonList count={skeletonCount} height={skeletonHeight} layout={skeletonLayout} />
  } else if (isEmpty) {
    body = <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  } else {
    body = children
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
