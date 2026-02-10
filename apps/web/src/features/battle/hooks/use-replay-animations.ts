"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { BattleLogEntry } from "@nasty-plot/battle-engine"
import {
  type AnimationEvent,
  type AnimationState,
  INITIAL_ANIMATION_STATE,
  logEntryToAnimation,
} from "./use-battle-animations"

/**
 * Animation hook for replay mode.
 *
 * Unlike useBattleAnimations (which watches state.fullLog growing),
 * this hook triggers animations when the replay frame changes by
 * processing the current frame's entries.
 */
export function useReplayAnimations(
  entries: BattleLogEntry[],
  frameIndex: number,
  options?: { speed?: number },
): AnimationState {
  const speed = options?.speed ?? 1
  const [animState, setAnimState] = useState<AnimationState>(INITIAL_ANIMATION_STATE)
  const prevFrameRef = useRef(frameIndex)
  const queueRef = useRef<AnimationEvent[]>([])
  const isProcessingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      if (queueRef.current.length === 0) {
        setAnimState((prev) => (prev.isAnimating ? INITIAL_ANIMATION_STATE : prev))
      }
      return
    }

    isProcessingRef.current = true
    const event = queueRef.current.shift()!

    setAnimState(() => {
      const next: AnimationState = {
        slotAnimations: {},
        textMessage: event.textMessage || null,
        damageNumbers: event.damageNumber ? [event.damageNumber] : [],
        isAnimating: true,
      }

      if (event.slotKey && event.cssClass) {
        next.slotAnimations[event.slotKey] = event.cssClass
      }

      return next
    })

    timeoutRef.current = setTimeout(() => {
      isProcessingRef.current = false
      processQueue()
    }, event.duration)
  }, [])

  useEffect(() => {
    if (frameIndex === prevFrameRef.current) return
    prevFrameRef.current = frameIndex

    // Clear any in-flight animation
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    isProcessingRef.current = false
    queueRef.current = []
    setAnimState(INITIAL_ANIMATION_STATE)

    // Queue animations for the new frame's entries
    for (const entry of entries) {
      const anim = logEntryToAnimation(entry, speedRef.current)
      if (anim) {
        queueRef.current.push(anim)
      }
    }

    if (queueRef.current.length > 0) {
      processQueue()
    }
  }, [frameIndex, entries, processQueue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return animState
}
