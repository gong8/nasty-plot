import { useCallback } from "react"
import { usePageContext } from "@/features/chat/context/page-context-provider"
import { useBattleStateContext } from "@/features/battle/context/battle-state-context"
import type { ChatContextMode } from "@nasty-plot/core"

export const PAGE_TO_CONTEXT_MODE: Record<string, ChatContextMode> = {
  "guided-builder": "guided-builder",
  "team-editor": "team-editor",
  "battle-live": "battle-live",
  "battle-replay": "battle-replay",
}

export const CONTEXT_MODE_LABELS: Record<ChatContextMode, string> = {
  "guided-builder": "Team Building Advisor",
  "team-editor": "Team Optimization Expert",
  "battle-live": "Battle Coach",
  "battle-replay": "Replay Analyst",
}

export const CONTEXT_MODE_DESCRIPTIONS: Record<ChatContextMode, string> = {
  "guided-builder":
    "Pecharunt has tools to search Pokemon, add team slots, update sets, and analyze your team composition.",
  "team-editor":
    "Pecharunt has tools to modify your team, optimize EVs, suggest replacements, and run damage calcs.",
  "battle-live":
    "Pecharunt can look up data and analyze matchups to coach you through the battle in real time.",
  "battle-replay":
    "Pecharunt can analyze the replay, identify misplays, and suggest improvements for next time.",
}

export interface UseBuildContextDataReturn {
  contextMode: ChatContextMode
  hasContext: boolean
  buildContextData: () => Record<string, unknown>
}

export function useBuildContextData(): UseBuildContextDataReturn {
  const pageContext = usePageContext()
  const { battleState } = useBattleStateContext()

  const contextMode = PAGE_TO_CONTEXT_MODE[pageContext.pageType]
  const hasContext = !!contextMode

  const buildContextData = useCallback((): Record<string, unknown> => {
    const data: Record<string, unknown> = {}

    if (contextMode === "guided-builder" || contextMode === "team-editor") {
      if (pageContext.teamId) data.teamId = pageContext.teamId
      if (pageContext.teamData) {
        data.teamName = pageContext.teamData.name
        data.formatId = pageContext.teamData.formatId

        // Include team composition so the LLM has slot info even if server fetch fails
        const slots = pageContext.teamData.slots
        data.slotsFilled = slots.length
        data.slots = slots.map((slot) => {
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
  }, [contextMode, pageContext, battleState])

  return { contextMode, hasContext, buildContextData }
}
