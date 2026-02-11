"use client"

import { useEffect, useRef, useCallback } from "react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { buildAutoAnalyzePrompt } from "@nasty-plot/llm/browser"
import type { BattleState } from "@nasty-plot/battle-engine"

/**
 * Watches battle state and triggers auto-analyze via the chat sidebar.
 * Triggers on:
 *  1. Turn advances (state.turn changes)
 *  2. Forced switch after KO (same turn, but waitingForChoice + forceSwitch)
 */
export function useAutoAnalyze(state: BattleState) {
  const { autoAnalyze, triggerAutoAnalyze, stopAutoAnalyze, isAutoAnalyzing } = useChatSidebar()
  const lastAnalyzedTurn = useRef<number>(0)
  const lastAnalyzedForceSwitch = useRef<boolean>(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!autoAnalyze.enabled || state.phase !== "battle") return

    const isForceSwitch = state.waitingForChoice && (state.availableActions?.forceSwitch ?? false)
    const isTurnAdvance = state.turn > lastAnalyzedTurn.current
    const isNewForceSwitch = isForceSwitch && !lastAnalyzedForceSwitch.current

    // Only trigger on turn advance or a new forced switch
    if (!isTurnAdvance && !isNewForceSwitch) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      lastAnalyzedTurn.current = state.turn
      lastAnalyzedForceSwitch.current = isForceSwitch
      const recentEntries = state.log.slice(-10)
      const prompt = buildAutoAnalyzePrompt(state, autoAnalyze.depth, recentEntries)
      triggerAutoAnalyze(prompt, state.turn, autoAnalyze.depth)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    state.turn,
    state.phase,
    state.waitingForChoice,
    state.availableActions?.forceSwitch,
    autoAnalyze.enabled,
    autoAnalyze.depth,
    state,
    triggerAutoAnalyze,
  ])

  // Reset force switch tracking when a non-force-switch choice arrives
  useEffect(() => {
    if (state.waitingForChoice && !state.availableActions?.forceSwitch) {
      lastAnalyzedForceSwitch.current = false
    }
  }, [state.waitingForChoice, state.availableActions?.forceSwitch])

  /**
   * Abort any in-progress auto-analysis. Call before submitting a move or switch.
   */
  const abortIfAnalyzing = useCallback(() => {
    if (isAutoAnalyzing) {
      stopAutoAnalyze()
    }
  }, [isAutoAnalyzing, stopAutoAnalyze])

  return { abortIfAnalyzing }
}
