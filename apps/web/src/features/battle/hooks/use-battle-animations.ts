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

/** Per-type animation config: [minDuration, cssClass, useSlotKey] */
const ANIMATION_CONFIG: Record<string, [number, string, boolean]> = {
  move: [600, "", false],
  damage: [500, "animate-battle-shake", true],
  heal: [400, "", true],
  faint: [800, "animate-battle-faint", true],
  switch: [500, "animate-battle-switch-in", true],
  tera: [600, "animate-battle-tera", true],
  status: [500, "animate-battle-status", true],
  boost: [500, "animate-battle-boost", true],
  unboost: [500, "animate-battle-unboost", true],
  crit: [600, "", false],
  supereffective: [600, "", false],
  resisted: [500, "", false],
  immune: [500, "", false],
  weather: [600, "", false],
  terrain: [600, "", false],
  hazard: [500, "", false],
  item: [500, "", false],
  ability: [500, "", false],
  start: [500, "", false],
  end: [500, "", false],
  cant: [500, "", false],
  info: [500, "", false],
  win: [2000, "", false],
}

/** Map a log entry to an animation event (or null if no animation). */
export function logEntryToAnimation(
  entry: BattleLogEntry,
  speed: number = 1,
): AnimationEvent | null {
  const config = ANIMATION_CONFIG[entry.type]
  if (!config) return null

  const [minDuration, cssClass, useSlotKey] = config
  const { side, message: msg } = entry
  const slotKey = useSlotKey && side ? `${side}-0` : undefined

  const event: AnimationEvent = {
    type: entry.type,
    side,
    slotKey,
    cssClass,
    duration: textDuration(msg, minDuration, speed),
    textMessage: msg,
  }

  if (entry.type === "damage" && side) {
    event.damageNumber = { value: extractDamagePercent(msg, false), side, slot: 0 }
  } else if (entry.type === "heal" && side) {
    event.damageNumber = { value: extractDamagePercent(msg, true), side, slot: 0 }
  }

  return event
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

      processQueue() // eslint-disable-line react-hooks/immutability -- deferred self-reference via setTimeout
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

      // Safety valve: force-clear if queue gets stuck.
      // Timeout scales with queue size so long turns don't get cut short.
      const totalDuration = queueRef.current.reduce((sum, e) => sum + e.duration, 0)
      const safetyMs = Math.max(10000, totalDuration + 3000)
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = setTimeout(() => {
        if (isProcessingRef.current || queueRef.current.length > 0) {
          queueRef.current = []
          isProcessingRef.current = false
          setAnimState(INITIAL_ANIMATION_STATE)
        }
      }, safetyMs)

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
