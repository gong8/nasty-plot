import { Loader2 } from "lucide-react"
import { cn } from "@nasty-plot/ui"

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
  label?: string
}

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

export function LoadingSpinner({ className, size = "md", label }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <Loader2 className={cn("animate-spin text-muted-foreground", SIZES[size])} />
      {label && <span className="ml-3 text-muted-foreground">{label}</span>}
    </div>
  )
}
