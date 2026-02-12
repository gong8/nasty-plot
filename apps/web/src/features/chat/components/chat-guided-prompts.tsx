"use client"

import { useMemo } from "react"
import { Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatGuidedPromptsProps {
  step: string
  teamSize: number
  onSend: (message: string) => void
  isStreaming: boolean
}

interface PromptSuggestion {
  label: string
  message: string
}

function getPrompts(step: string, teamSize: number): PromptSuggestion[] {
  switch (step) {
    case "start":
      return [
        {
          label: "What playstyle fits me?",
          message:
            "What playstyle should I build around? Explain the differences between offense, balance, and stall.",
        },
        {
          label: "Explain the meta",
          message:
            "Give me a quick overview of the current meta. What are the top threats I should know about?",
        },
        {
          label: "Offense or balance?",
          message:
            "Should I go with a hyper offense team or a balanced team? What are the pros and cons?",
        },
      ]

    case "lead":
      return [
        {
          label: "Best leads right now?",
          message:
            "What are the strongest leads in the current meta? Who can set the pace of a game?",
        },
        {
          label: "Who sets hazards?",
          message: "Which Pokemon are the best hazard setters I could lead with?",
        },
        {
          label: "Suggest a lead",
          message: "Suggest a strong lead Pokemon for me and explain why it's a good choice.",
        },
      ]

    case "build":
      if (teamSize <= 2) {
        return [
          {
            label: "What type am I missing?",
            message: "Looking at my current team, what type coverage am I missing?",
          },
          {
            label: "Suggest a core",
            message:
              "Can you suggest a Pokemon that forms a good defensive or offensive core with what I have?",
          },
          {
            label: "Who pairs well?",
            message: "Who pairs well with my current Pokemon? What synergies should I look for?",
          },
        ]
      }
      if (teamSize <= 4) {
        return [
          {
            label: "What's my biggest gap?",
            message: "What's the biggest gap in my team right now? Any glaring weaknesses?",
          },
          {
            label: "Need a revenge killer?",
            message: "Do I need a revenge killer or a scarfer on this team? Who would fit?",
          },
          {
            label: "Hazard removal?",
            message: "Does my team need hazard removal? If so, who's the best fit?",
          },
        ]
      }
      return [
        {
          label: "Who rounds this out?",
          message: "Who would be the best final Pokemon to round out my team?",
        },
        {
          label: "Check my coverage",
          message: "Check my team's type coverage. Am I missing anything critical?",
        },
        {
          label: "Any weaknesses?",
          message: "Does my team have any glaring weaknesses or common threats I can't handle?",
        },
      ]

    case "sets":
      return [
        {
          label: "Optimize my EVs",
          message: "Can you review my EV spreads and suggest optimizations for each Pokemon?",
        },
        {
          label: "Better move options?",
          message: "Are there any better move options for my team? Any coverage moves I'm missing?",
        },
        {
          label: "Suggest items",
          message: "Review my item choices. Are there better items for any of my Pokemon?",
        },
      ]

    case "review":
      return [
        {
          label: "Rate my team",
          message: "Rate my team overall. What are its strengths and weaknesses?",
        },
        {
          label: "Biggest threats?",
          message: "What are the biggest threats to my team in the current meta?",
        },
        {
          label: "Any changes needed?",
          message: "Is there anything you'd change about my team before I finalize it?",
        },
      ]

    default:
      return []
  }
}

export function ChatGuidedPrompts({ step, teamSize, onSend, isStreaming }: ChatGuidedPromptsProps) {
  const prompts = useMemo(() => getPrompts(step, teamSize), [step, teamSize])

  if (prompts.length === 0 || isStreaming) return null

  return (
    <div className="px-3 pb-1.5 pt-1">
      <div className="flex items-center gap-1 mb-1.5">
        <Lightbulb className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
          Ask Pecharunt
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => onSend(prompt.message)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              "bg-muted/50 border-border/50 text-muted-foreground",
              "hover:bg-primary/10 hover:border-primary/30 hover:text-foreground",
            )}
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
