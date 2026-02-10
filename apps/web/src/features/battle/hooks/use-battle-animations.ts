"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { BattleLogEntry, BattleState } from "@nasty-plot/battle-engine"

export interface AnimationEvent {
  type: string
  slotKey?: string // e.g. "p1-0", "p2-1"
  side?: "p1" | "p2"
  cssClass: string
  duration: number // ms
  textMessage?: string
  damageNumber?: { value: string; side: "p1" | "p2"; slot: number }
}

export interface AnimationState {
  /** CSS class per slot, keyed by "p1-0", "p2-0", etc. */
  slotAnimations: Record<string, string>
  /** Current text for the battle text box */
  textMessage: string | null
  /** Currently displayed damage/heal numbers */
  damageNumbers: { value: string; side: "p1" | "p2"; slot: number }[]
  /** Whether any animation is currently playing — gates player input */
  isAnimating: boolean
}

export const INITIAL_ANIMATION_STATE: AnimationState = {
  slotAnimations: {},
  textMessage: null,
  damageNumbers: [],
  isAnimating: false,
}

/**
 * Compute how long an event should stay on screen:
 * typing time (15ms/char to match BattleTextBox) + hold time for reading.
 * Returns at least `minDuration` to ensure sprite animations complete.
 */
function textDuration(message: string, minDuration: number, speed: number): number {
  const CHAR_DELAY = 8 // must match BattleTextBox charDelay base
  const HOLD_TIME = 1600 // ms to hold text after typing finishes
  const typingTime = message.length * CHAR_DELAY
  return Math.max(minDuration, typingTime + HOLD_TIME) / speed
}

/** Map a log entry to an animation event (or null if no animation). */
export function logEntryToAnimation(
  entry: BattleLogEntry,
  speed: number = 1,
): AnimationEvent | null {
  const side = entry.side
  const slotKey = side ? `${side}-0` : undefined // Default to slot 0 for singles
  const msg = entry.message

  switch (entry.type) {
    case "move":
      return {
        type: "move",
        side,
        cssClass: "",
        duration: textDuration(msg, 600, speed),
        textMessage: msg,
      }

    case "damage":
      return {
        type: "damage",
        slotKey,
        side,
        cssClass: "animate-battle-shake",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
        damageNumber: side
          ? {
              value: extractDamagePercent(msg, false),
              side,
              slot: 0,
            }
          : undefined,
      }

    case "heal":
      return {
        type: "heal",
        slotKey,
        side,
        cssClass: "",
        duration: textDuration(msg, 400, speed),
        textMessage: msg,
        damageNumber: side
          ? {
              value: extractDamagePercent(msg, true),
              side,
              slot: 0,
            }
          : undefined,
      }

    case "faint":
      return {
        type: "faint",
        slotKey,
        side,
        cssClass: "animate-battle-faint",
        duration: textDuration(msg, 800, speed),
        textMessage: msg,
      }

    case "switch":
      return {
        type: "switch",
        slotKey,
        side,
        cssClass: "animate-battle-switch-in",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "tera":
      return {
        type: "tera",
        slotKey,
        side,
        cssClass: "animate-battle-tera",
        duration: textDuration(msg, 600, speed),
        textMessage: msg,
      }

    case "status":
      return {
        type: "status",
        slotKey,
        side,
        cssClass: "animate-battle-status",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "boost":
      return {
        type: "boost",
        slotKey,
        side,
        cssClass: "animate-battle-boost",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "unboost":
      return {
        type: "unboost",
        slotKey,
        side,
        cssClass: "animate-battle-unboost",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "crit":
      return {
        type: "crit",
        cssClass: "",
        duration: textDuration(msg, 600, speed),
        textMessage: msg,
      }

    case "supereffective":
      return {
        type: "supereffective",
        cssClass: "",
        duration: textDuration(msg, 600, speed),
        textMessage: msg,
      }

    case "resisted":
      return {
        type: "resisted",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "immune":
      return {
        type: "immune",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "weather":
      return {
        type: "weather",
        cssClass: "",
        duration: textDuration(msg, 600, speed),
        textMessage: msg,
      }

    case "terrain":
      return {
        type: "terrain",
        cssClass: "",
        duration: textDuration(msg, 600, speed),
        textMessage: msg,
      }

    case "hazard":
      return {
        type: "hazard",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "item":
      return {
        type: "item",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "ability":
      return {
        type: "ability",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "start":
      return {
        type: "start",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "end":
      return {
        type: "end",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "cant":
      return {
        type: "cant",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "info":
      return {
        type: "info",
        cssClass: "",
        duration: textDuration(msg, 500, speed),
        textMessage: msg,
      }

    case "win":
      return {
        type: "win",
        cssClass: "",
        duration: textDuration(msg, 2000, speed),
        textMessage: msg,
      }

    case "turn":
      // Turn separators — skip (no animation or text)
      return null

    default:
      return null
  }
}

/** Extract damage/heal percentage from log message. */
function extractDamagePercent(message: string, isHeal: boolean): string {
  // Match patterns like "(45%, -45%)" or "(+20%)"
  const deltaMatch = message.match(/([+-]\d+%)/)
  if (deltaMatch) return deltaMatch[1]

  // Fallback: extract any percentage
  const pctMatch = message.match(/(\d+)%/)
  if (pctMatch) return `${isHeal ? "+" : "-"}${pctMatch[1]}%`

  return isHeal ? "+?%" : "-?%"
}

/**
 * Central animation orchestrator hook.
 *
 * Detects new battle log entries, maps them to animation events,
 * and queues them sequentially with appropriate timing.
 */
export function useBattleAnimations(
  state: BattleState,
  options?: { speed?: number },
): AnimationState {
  const speed = options?.speed ?? 1
  const [animState, setAnimState] = useState<AnimationState>(INITIAL_ANIMATION_STATE)
  // Start at current log length so we don't animate history on mount
  const lastLogLengthRef = useRef(state.fullLog.length)
  const mountedRef = useRef(false)
  const queueRef = useRef<AnimationEvent[]>([])
  const isProcessingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      // Queue empty — clear all animations
      if (queueRef.current.length === 0) {
        setAnimState(INITIAL_ANIMATION_STATE)
      }
      return
    }

    isProcessingRef.current = true
    const event = queueRef.current.shift()!

    // Apply this event's animation
    setAnimState((prev) => {
      const next: AnimationState = {
        slotAnimations: { ...prev.slotAnimations },
        textMessage: event.textMessage || null,
        damageNumbers: event.damageNumber ? [event.damageNumber] : [],
        isAnimating: true,
      }

      if (event.slotKey && event.cssClass) {
        next.slotAnimations[event.slotKey] = event.cssClass
      }

      return next
    })

    // After the animation duration, clear and process next
    timeoutRef.current = setTimeout(() => {
      isProcessingRef.current = false

      // Clear the animation for this event's slot
      if (event.slotKey) {
        setAnimState((prev) => {
          const next = { ...prev }
          next.slotAnimations = { ...prev.slotAnimations }
          delete next.slotAnimations[event.slotKey!]
          return next
        })
      }

      processQueue()
    }, event.duration)
  }, [])

  // Detect new log entries and queue animations
  useEffect(() => {
    // Skip the initial mount — lastLogLengthRef is already set to current length
    if (!mountedRef.current) {
      mountedRef.current = true
      lastLogLengthRef.current = state.fullLog.length
      return
    }

    const fullLog = state.fullLog
    const prevLength = lastLogLengthRef.current

    if (fullLog.length > prevLength) {
      const newEntries = fullLog.slice(prevLength)
      lastLogLengthRef.current = fullLog.length

      for (const entry of newEntries) {
        const anim = logEntryToAnimation(entry, speedRef.current)
        if (anim) {
          queueRef.current.push(anim)
        }
      }

      // Safety valve: force-clear isAnimating after 5s in case the queue gets stuck
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = setTimeout(() => {
        if (isProcessingRef.current || queueRef.current.length > 0) {
          queueRef.current = []
          isProcessingRef.current = false
          setAnimState(INITIAL_ANIMATION_STATE)
        }
      }, 5000)

      // Start processing if not already
      if (!isProcessingRef.current) {
        processQueue()
      }
    }
  }, [state.fullLog, state.fullLog.length, processQueue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
    }
  }, [])

  return animState
}
