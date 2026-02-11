"use client"

import { useRef, useEffect, useCallback } from "react"
import type { TeamSlotData } from "@nasty-plot/core"
import type { GuidedStep } from "./use-guided-builder"

interface UseProactiveReactionsOptions {
  slots: Partial<TeamSlotData>[]
  step: GuidedStep
  formatId?: string
  isStreaming: boolean
  sendMessage: (text: string) => void
}

/**
 * Watches guided builder state and triggers LLM commentary when
 * the user makes picks. Sends [WIZARD_EVENT] prefixed messages
 * that the LLM can respond to with brief educational commentary.
 */
export function useProactiveReactions({
  slots,
  step,
  isStreaming,
  sendMessage,
}: UseProactiveReactionsOptions) {
  const prevSlotsRef = useRef<string[]>([])
  const lastReactionTimeRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const triggerReaction = useCallback(
    (newPokemonIds: string[]) => {
      if (isStreaming) return
      if (newPokemonIds.length === 0) return

      // Rate limit: max 1 proactive reaction per 10 seconds
      const now = Date.now()
      if (now - lastReactionTimeRef.current < 10_000) return
      lastReactionTimeRef.current = now

      // Build event message
      const names = newPokemonIds.join(", ")
      const stepLabel =
        step === "lead"
          ? "as my lead"
          : step === "build"
            ? `to slot ${slots.filter((s) => s.pokemonId).length}`
            : ""

      const message = `[WIZARD_EVENT] I just added ${names} to my team${stepLabel ? ` ${stepLabel}` : ""}.`
      sendMessage(message)
    },
    [isStreaming, step, slots, sendMessage],
  )

  useEffect(() => {
    // Only trigger in pick steps
    if (step !== "lead" && step !== "build") {
      prevSlotsRef.current = slots.filter((s) => s.pokemonId).map((s) => s.pokemonId!)
      return
    }

    const currentIds = slots.filter((s) => s.pokemonId).map((s) => s.pokemonId!)
    const prevIds = prevSlotsRef.current

    // Find newly added Pokemon
    const newIds = currentIds.filter((id) => !prevIds.includes(id))
    prevSlotsRef.current = currentIds

    if (newIds.length === 0) return

    // Debounce 1.5s — batch rapid picks (e.g., sample team import)
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      triggerReaction(newIds)
    }, 1500)

    return () => clearTimeout(debounceTimerRef.current)
  }, [slots, step, triggerReaction])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(debounceTimerRef.current)
  }, [])
}
