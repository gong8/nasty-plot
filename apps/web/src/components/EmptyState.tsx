import { cn } from "@nasty-plot/ui"

interface EmptyStateProps {
  children: React.ReactNode
  className?: string
  dashed?: boolean
}

export function EmptyState({ children, className, dashed }: EmptyStateProps) {
  if (dashed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed p-8",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    )
  }

  return (
    <div className={cn("text-center py-12 text-muted-foreground", className)}>
      {typeof children === "string" ? <p>{children}</p> : children}
    </div>
  )
}
