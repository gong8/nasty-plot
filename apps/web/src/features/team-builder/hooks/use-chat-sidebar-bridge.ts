"use client"

import { useRef, useEffect, useMemo } from "react"
import type { TeamSlotData, PokemonType, UsageStatsEntry } from "@nasty-plot/core"
import { useChatSidebar } from "@/features/chat/context/ChatProvider"
import { useQueryClient } from "@tanstack/react-query"
import { fetchApiData } from "@/lib/api-client"
import { useProactiveReactions } from "./use-proactive-reactions"
import type { GuidedStep, GuidedPokemonPick } from "./use-guided-builder"
import type { GuidedBuilderChatContext } from "../context/GuidedBuilderProvider"

const STEP_DESCRIPTIONS: Record<GuidedStep, string> = {
  start: "Choosing a starting point",
  lead: "Picking lead Pokemon",
  build: "Building the team",
  sets: "Customizing movesets and sets",
  review: "Final review",
}

interface GuidedState {
  step: GuidedStep
  currentBuildSlot: number
  slots: Partial<TeamSlotData>[]
  filledSlots: Partial<TeamSlotData>[]
  usageData: UsageStatsEntry[]
  analysis: { coverage?: { sharedWeaknesses?: string[]; uncoveredTypes?: string[] } } | null
  validationErrors: { errors: string[]; warnings: string[] }
  addSlotPick: (position: number, pick: GuidedPokemonPick) => void
  updateSlot: (position: number, updates: Partial<TeamSlotData>) => void
  removeSlot: (position: number) => void
  goToStep: (step: GuidedStep) => void
  nextBuildSlot: () => void
}

interface UseChatSidebarBridgeOptions {
  teamId: string
  formatId: string
  guided: GuidedState
}

export function useChatSidebarBridge({ teamId, formatId, guided }: UseChatSidebarBridgeOptions) {
  const {
    openContextChat,
    openSidebar,
    switchSession,
    setGuidedBuilderContext,
    guidedActionNotifyRef,
    queueAutoSend,
    isChatStreaming,
  } = useChatSidebar()
  const queryClient = useQueryClient()

  // Auto-open sidebar with guided-builder session on mount
  const sessionInitRef = useRef(false)
  useEffect(() => {
    if (sessionInitRef.current) return
    sessionInitRef.current = true
    ;(async () => {
      try {
        const sessions = await fetchApiData<Array<{ id: string }>>(
          `/api/chat/sessions?teamId=${teamId}&contextMode=guided-builder`,
        )
        if (sessions.length > 0) {
          switchSession(sessions[0].id)
          openSidebar()
        } else {
          openContextChat({
            contextMode: "guided-builder",
            contextData: JSON.stringify({ teamId, formatId }),
          })
        }
      } catch {
        openContextChat({
          contextMode: "guided-builder",
          contextData: JSON.stringify({ teamId, formatId }),
        })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, formatId])

  // --- Chat context (always-fresh for LLM) ---

  const chatContext = useMemo((): GuidedBuilderChatContext => {
    const slotSummaries = guided.filledSlots.map((s) => {
      const movesStr = s.moves?.filter(Boolean).join(", ") || "No moves"
      return `${s.pokemonId} (${s.ability || "no ability"}, ${s.item || "no item"}) - ${movesStr}`
    })

    const slots = guided.filledSlots.map((s) => {
      // Try to get types from usage data
      const usage = guided.usageData.find((u) => u.pokemonId === s.pokemonId)
      return {
        position: s.position!,
        pokemonId: s.pokemonId!,
        pokemonName: usage?.pokemonName,
        types: usage?.types as PokemonType[] | undefined,
        ability: s.ability || undefined,
        item: s.item || undefined,
        nature: s.nature || undefined,
        teraType: s.teraType || undefined,
        moves: s.moves?.filter(Boolean) as string[] | undefined,
        evs: s.evs as Record<string, number> | undefined,
      }
    })

    const { coverage } = guided.analysis ?? {}
    const analysisSummary = coverage
      ? [
          coverage.sharedWeaknesses?.length
            ? `Shared weaknesses: ${coverage.sharedWeaknesses.join(", ")}`
            : null,
          coverage.uncoveredTypes?.length
            ? `Missing coverage: ${coverage.uncoveredTypes.join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join(". ")
      : undefined

    return {
      step: guided.step,
      stepDescription:
        guided.step === "build"
          ? `Building slot ${guided.currentBuildSlot} of 6`
          : STEP_DESCRIPTIONS[guided.step],
      teamSize: guided.filledSlots.length,
      currentBuildSlot: guided.currentBuildSlot,
      formatId,
      slots,
      slotSummaries,
      validationErrors:
        guided.validationErrors.errors.length > 0 ? guided.validationErrors.errors : undefined,
      validationWarnings:
        guided.validationErrors.warnings.length > 0 ? guided.validationErrors.warnings : undefined,
      analysisSummary: analysisSummary || undefined,
    }
  }, [guided, formatId])

  // Sync guided builder context to ChatProvider so sidebar can use it
  useEffect(() => {
    setGuidedBuilderContext(chatContext as unknown as Record<string, unknown>)
    return () => setGuidedBuilderContext(null)
  }, [chatContext, setGuidedBuilderContext])

  // Register action notify handler so sidebar MCP actions update the wizard
  useEffect(() => {
    guidedActionNotifyRef.current = (notification) => {
      const { name, input } = notification

      switch (name) {
        case "add_pokemon_to_team": {
          const pokemonId = input.pokemonId as string
          const position = (input.position as number) || guided.filledSlots.length + 1
          const usageEntry = guided.usageData.find((u) => u.pokemonId === pokemonId)
          guided.addSlotPick(position, {
            pokemonId,
            pokemonName: usageEntry?.pokemonName ?? pokemonId,
            types: (usageEntry?.types ?? []) as GuidedPokemonPick["types"],
            usagePercent: usageEntry?.usagePercent,
          })
          if (guided.step === "lead" && position === 1) {
            guided.goToStep("build")
          } else if (guided.step === "build") {
            if (guided.filledSlots.length + 1 >= 6) {
              guided.goToStep("sets")
            } else {
              guided.nextBuildSlot()
            }
          }
          break
        }
        case "update_pokemon_set": {
          const position = input.position as number
          if (!position) return
          const moves = input.moves as string[] | undefined
          guided.updateSlot(position, {
            ability: (input.ability as string) || undefined,
            item: (input.item as string) || undefined,
            nature: ((input.nature as string) || undefined) as
              | import("@nasty-plot/core").NatureName
              | undefined,
            teraType: ((input.teraType as string) || undefined) as
              | import("@nasty-plot/core").PokemonType
              | undefined,
            moves: moves
              ? ([moves[0], moves[1], moves[2], moves[3]] as [string, string?, string?, string?])
              : undefined,
            evs: input.evs as import("@nasty-plot/core").StatsTable | undefined,
            ivs: input.ivs as import("@nasty-plot/core").StatsTable | undefined,
          })
          break
        }
        case "remove_pokemon_from_team": {
          const position = input.position as number
          if (!position) return
          guided.removeSlot(position)
          break
        }
        default:
          return
      }
      queryClient.invalidateQueries({ queryKey: ["team"] })
    }
    return () => {
      guidedActionNotifyRef.current = null
    }
  }, [guided, guidedActionNotifyRef, queryClient])

  // Proactive reactions — auto-commentary when user picks Pokemon
  useProactiveReactions({
    slots: guided.slots,
    step: guided.step,
    formatId,
    isStreaming: isChatStreaming,
    sendMessage: queueAutoSend,
  })

  return { chatContext }
}
