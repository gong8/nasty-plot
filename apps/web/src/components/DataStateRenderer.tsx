import type { ReactNode } from "react"

interface DataStateRendererProps<T> {
  data: T | null
  loading: boolean
  error?: string | null
  loadingContent?: ReactNode
  emptyContent?: ReactNode
  isEmpty?: (data: T) => boolean
  children: (data: T) => ReactNode
}

export function DataStateRenderer<T>({
  data,
  loading,
  error,
  loadingContent,
  emptyContent,
  isEmpty,
  children,
}: DataStateRendererProps<T>) {
  if (loading)
    return (
      <>
        {loadingContent ?? <div className="text-center py-8 text-muted-foreground">Loading...</div>}
      </>
    )
  if (error) return <div className="text-center py-8 text-destructive">{error}</div>
  if (!data || (isEmpty && isEmpty(data)))
    return (
      <>
        {emptyContent ?? (
          <div className="text-center py-8 text-muted-foreground">No data found.</div>
        )}
      </>
    )
  return <>{children(data)}</>
}
