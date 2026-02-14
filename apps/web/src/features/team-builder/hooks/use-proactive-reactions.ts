"use client"

import { useRef, useEffect, useCallback } from "react"
import type { TeamSlotData } from "@nasty-plot/core"
import type { GuidedStep } from "./use-guided-builder"

const REACTION_COOLDOWN_MS = 10_000
const REACTION_DEBOUNCE_MS = 1500

function getFilledPokemonIds(slots: Partial<TeamSlotData>[]): string[] {
  return slots.filter((s) => s.pokemonId).map((s) => s.pokemonId!)
}

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

      const now = Date.now()
      if (now - lastReactionTimeRef.current < REACTION_COOLDOWN_MS) return
      lastReactionTimeRef.current = now

      // Build event message
      const names = newPokemonIds.join(", ")
      const stepLabel =
        step === "lead"
          ? "as my lead"
          : step === "build"
            ? `to slot ${getFilledPokemonIds(slots).length}`
            : ""

      const message = `[WIZARD_EVENT] I just added ${names} to my team${stepLabel ? ` ${stepLabel}` : ""}.`
      sendMessage(message)
    },
    [isStreaming, step, slots, sendMessage],
  )

  useEffect(() => {
    // Only trigger in pick steps
    if (step !== "lead" && step !== "build") {
      prevSlotsRef.current = getFilledPokemonIds(slots)
      return
    }

    const currentIds = getFilledPokemonIds(slots)
    const prevIds = prevSlotsRef.current

    // Find newly added Pokemon
    const newIds = currentIds.filter((id) => !prevIds.includes(id))
    prevSlotsRef.current = currentIds

    if (newIds.length === 0) return

    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      triggerReaction(newIds)
    }, REACTION_DEBOUNCE_MS)

    return () => clearTimeout(debounceTimerRef.current)
  }, [slots, step, triggerReaction])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(debounceTimerRef.current)
  }, [])
}
