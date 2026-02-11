"use client"

import { usePageContext } from "@/features/chat/context/page-context-provider"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useBattleStateContext } from "@/features/battle/context/battle-state-context"
import type { ChatContextMode } from "@nasty-plot/core"
import { cn } from "@/lib/utils"
import { Globe, Lock } from "lucide-react"

const PAGE_TO_CONTEXT_MODE: Record<string, ChatContextMode> = {
  "guided-builder": "guided-builder",
  "team-editor": "team-editor",
  "battle-live": "battle-live",
  "battle-replay": "battle-replay",
}

const CONTEXT_MODE_LABELS: Record<ChatContextMode, string> = {
  "guided-builder": "Team Building Advisor",
  "team-editor": "Team Optimization Expert",
  "battle-live": "Battle Coach",
  "battle-replay": "Replay Analyst",
}

const CONTEXT_MODE_DESCRIPTIONS: Record<ChatContextMode, string> = {
  "guided-builder":
    "Pecharunt has tools to search Pokemon, add team slots, update sets, and analyze your team composition.",
  "team-editor":
    "Pecharunt has tools to modify your team, optimize EVs, suggest replacements, and run damage calcs.",
  "battle-live":
    "Pecharunt can look up data and analyze matchups to coach you through the battle in real time.",
  "battle-replay":
    "Pecharunt can analyze the replay, identify misplays, and suggest improvements for next time.",
}

interface ChatContextPickerProps {
  onModeChosen: () => void
}

export function ChatContextPicker({ onModeChosen }: ChatContextPickerProps) {
  const pageContext = usePageContext()
  const { battleState } = useBattleStateContext()
  const { openContextChat } = useChatSidebar()

  const contextMode = PAGE_TO_CONTEXT_MODE[pageContext.pageType]
  const hasContext = !!contextMode

  function buildContextData(): Record<string, unknown> {
    const data: Record<string, unknown> = {}

    if (contextMode === "guided-builder" || contextMode === "team-editor") {
      if (pageContext.teamId) data.teamId = pageContext.teamId
      if (pageContext.teamData) {
        data.teamName = pageContext.teamData.name
        data.formatId = pageContext.teamData.formatId
        data.slotsFilled = pageContext.teamData.slots.length
        data.slots = pageContext.teamData.slots.map((slot) => {
          const name = slot.species?.name ?? slot.pokemonId
          const types = slot.species?.types.join("/") ?? "Unknown"
          const moves = slot.moves.filter(Boolean).join(", ") || "None"
          return `${name} (${types}) - ${moves}`
        })
      }
      if (pageContext.formatId) data.formatId = pageContext.formatId
    }

    if (contextMode === "battle-live") {
      if (pageContext.formatId) data.formatId = pageContext.formatId
      if (battleState) {
        data.gameType = battleState.format
        data.team1Name = battleState.sides.p1.name
        data.team2Name = battleState.sides.p2.name
      }
    }

    if (contextMode === "battle-replay") {
      if (pageContext.battleId) data.battleId = pageContext.battleId
    }

    return data
  }

  function handleGlobal() {
    onModeChosen()
  }

  function handleContextLocked() {
    if (!contextMode) return
    const contextData = buildContextData()
    openContextChat({
      contextMode,
      contextData: JSON.stringify(contextData),
    })
    onModeChosen()
  }

  return (
    <div className="text-center py-8 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
        alt="Pecharunt"
        width={64}
        height={64}
        className="pixelated mx-auto mb-3"
      />
      <p className="text-lg font-medium text-foreground">Pecharunt&apos;s Team Lab</p>
      <p className="text-sm mt-1 mb-6 text-muted-foreground">Choose how you&apos;d like to chat.</p>

      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        {/* Global */}
        <button
          onClick={handleGlobal}
          className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
        >
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Global</div>
              <div className="text-xs text-muted-foreground mt-1">
                General-purpose chat. Pecharunt can discuss anything competitive Pokemon without
                tools tied to a specific page.
              </div>
            </div>
          </div>
        </button>

        {/* Context-locked */}
        <button
          onClick={handleContextLocked}
          disabled={!hasContext}
          className={cn(
            "w-full text-left px-4 py-3 rounded-lg border transition-colors",
            hasContext ? "hover:bg-accent" : "opacity-50 cursor-not-allowed",
          )}
        >
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">
                {hasContext ? CONTEXT_MODE_LABELS[contextMode] : "Context-locked"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {hasContext
                  ? CONTEXT_MODE_DESCRIPTIONS[contextMode]
                  : "Navigate to a team or battle page to use scoped mode with access to specific tools."}
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
