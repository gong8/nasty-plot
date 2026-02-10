"use client"

import { Loader2, Check, Circle, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PlanStep {
  text: string
  status: "pending" | "active" | "complete" | "skipped"
}

interface ChatPlanDisplayProps {
  steps: PlanStep[]
}

const statusIcons: Record<PlanStep["status"], React.ReactNode> = {
  pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  active: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
  complete: <Check className="h-3.5 w-3.5 text-green-500" />,
  skipped: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
}

export function ChatPlanDisplay({ steps }: ChatPlanDisplayProps) {
  if (steps.length === 0) return null

  return (
    <div className="ml-12 my-2">
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-2">Plan</div>
        <ul className="space-y-1.5">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">{statusIcons[step.status]}</div>
              <span
                className={cn(
                  "text-xs",
                  step.status === "complete" && "text-muted-foreground",
                  step.status === "skipped" && "text-muted-foreground line-through",
                  step.status === "active" && "text-foreground font-medium",
                  step.status === "pending" && "text-muted-foreground",
                )}
              >
                {step.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
