"use client"

import type { TeamAnalysis } from "@nasty-plot/core"
import { AlertTriangle, Info, Lightbulb } from "lucide-react"
import { ConceptTooltip } from "./concept-tooltip"
import { cn } from "@/lib/utils"

interface RoleSuggestionBannerProps {
  analysis: TeamAnalysis | null
  filledSlotCount: number
}

function getSuggestion(
  analysis: TeamAnalysis | null,
  filledSlotCount: number,
): { message: React.ReactNode; icon: "lightbulb" | "warning" | "info" } {
  if (analysis) {
    const { coverage } = analysis

    // Check for shared weaknesses (2+ team members weak to a type)
    if (coverage.sharedWeaknesses.length > 0) {
      const weakness = coverage.sharedWeaknesses[0]
      return {
        icon: "warning",
        message: (
          <>
            Your team is weak to <span className="font-medium capitalize">{weakness}</span>{" "}
            (multiple Pokemon). Consider a Pokemon that resists it.
          </>
        ),
      }
    }

    // Check for uncovered types
    if (coverage.uncoveredTypes.length > 0) {
      const displayTypes = coverage.uncoveredTypes.slice(0, 3)
      const typeList = displayTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")
      return {
        icon: "lightbulb",
        message: (
          <>
            {"You can't hit "}
            <span className="font-medium">{typeList}</span>
            {" super-effectively yet. Adding "}
            <ConceptTooltip term="coverage">coverage</ConceptTooltip>
            {" would help."}
          </>
        ),
      }
    }
  }

  if (filledSlotCount >= 4) {
    return {
      icon: "info",
      message: (
        <>
          Think about team roles: do you have a way to{" "}
          <ConceptTooltip term="hazard removal">remove hazards</ConceptTooltip>? A{" "}
          <ConceptTooltip term="revenge killer">revenge killer</ConceptTooltip>?
        </>
      ),
    }
  }

  if (filledSlotCount < 3) {
    return {
      icon: "lightbulb",
      message: <>Focus on building a strong offensive or defensive core first.</>,
    }
  }

  return {
    icon: "lightbulb",
    message: (
      <>
        Pick a Pokemon that complements your team. The recommendations below account for your
        current <ConceptTooltip term="coverage">coverage</ConceptTooltip>.
      </>
    ),
  }
}

const ICON_MAP = {
  lightbulb: Lightbulb,
  warning: AlertTriangle,
  info: Info,
} as const

export function RoleSuggestionBanner({ analysis, filledSlotCount }: RoleSuggestionBannerProps) {
  const { message, icon } = getSuggestion(analysis, filledSlotCount)
  const Icon = ICON_MAP[icon]

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border bg-muted/50 px-4 py-3")}>
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          icon === "warning" ? "text-amber-500" : "text-muted-foreground",
        )}
      />
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
    </div>
  )
}
