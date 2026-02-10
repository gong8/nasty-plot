"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BattleLogEntry, BattleState } from "@nasty-plot/battle-engine";

interface AnimationEvent {
  type: string;
  slotKey?: string; // e.g. "p1-0", "p2-1"
  side?: "p1" | "p2";
  cssClass: string;
  duration: number; // ms
  moveFlash?: { name: string; side: "p1" | "p2" };
  effectivenessFlash?: string;
  damageNumber?: { value: string; side: "p1" | "p2"; slot: number };
}

export interface AnimationState {
  /** CSS class per slot, keyed by "p1-0", "p2-0", etc. */
  slotAnimations: Record<string, string>;
  /** Currently displayed move name flash */
  moveFlash: { name: string; side: "p1" | "p2" } | null;
  /** Currently displayed effectiveness text */
  effectivenessFlash: string | null;
  /** Currently displayed damage/heal numbers */
  damageNumbers: { value: string; side: "p1" | "p2"; slot: number }[];
  /** Whether any animation is currently playing — gates player input */
  isAnimating: boolean;
}

const INITIAL_ANIMATION_STATE: AnimationState = {
  slotAnimations: {},
  moveFlash: null,
  effectivenessFlash: null,
  damageNumbers: [],
  isAnimating: false,
};

/** Map a log entry to an animation event (or null if no animation). */
function logEntryToAnimation(entry: BattleLogEntry): AnimationEvent | null {
  const side = entry.side;
  const slotKey = side ? `${side}-0` : undefined; // Default to slot 0 for singles

  switch (entry.type) {
    case "move": {
      // Extract move name from message like "Garchomp used Earthquake!"
      const moveMatch = entry.message.match(/used (.+?)!/);
      const moveName = moveMatch?.[1] || "";
      return {
        type: "move",
        side,
        cssClass: "",
        duration: 300,
        moveFlash: side ? { name: moveName, side } : undefined,
      };
    }

    case "damage":
      return {
        type: "damage",
        slotKey,
        side,
        cssClass: "animate-battle-shake",
        duration: 500,
        damageNumber: side
          ? {
              value: extractDamagePercent(entry.message, false),
              side,
              slot: 0,
            }
          : undefined,
      };

    case "heal":
      return {
        type: "heal",
        slotKey,
        side,
        cssClass: "",
        duration: 300,
        damageNumber: side
          ? {
              value: extractDamagePercent(entry.message, true),
              side,
              slot: 0,
            }
          : undefined,
      };

    case "faint":
      return {
        type: "faint",
        slotKey,
        side,
        cssClass: "animate-battle-faint",
        duration: 800,
      };

    case "switch":
      return {
        type: "switch",
        slotKey,
        side,
        cssClass: "animate-battle-switch-in",
        duration: 400,
      };

    case "tera":
      return {
        type: "tera",
        slotKey,
        side,
        cssClass: "animate-battle-tera",
        duration: 600,
      };

    case "status":
      return {
        type: "status",
        slotKey,
        side,
        cssClass: "animate-battle-status",
        duration: 300,
      };

    case "boost":
      return {
        type: "boost",
        slotKey,
        side,
        cssClass: "animate-battle-boost",
        duration: 400,
      };

    case "unboost":
      return {
        type: "unboost",
        slotKey,
        side,
        cssClass: "animate-battle-unboost",
        duration: 400,
      };

    case "crit":
      return {
        type: "crit",
        cssClass: "",
        duration: 800,
        effectivenessFlash: "Critical hit!",
      };

    case "supereffective":
      return {
        type: "supereffective",
        cssClass: "",
        duration: 800,
        effectivenessFlash: "It's super effective!",
      };

    case "resisted":
      return {
        type: "resisted",
        cssClass: "",
        duration: 600,
        effectivenessFlash: "Not very effective...",
      };

    case "immune":
      return {
        type: "immune",
        cssClass: "",
        duration: 600,
        effectivenessFlash: "It had no effect!",
      };

    default:
      return null;
  }
}

/** Extract damage/heal percentage from log message. */
function extractDamagePercent(message: string, isHeal: boolean): string {
  // Match patterns like "(45%, -45%)" or "(+20%)"
  const deltaMatch = message.match(/([+-]\d+%)/);
  if (deltaMatch) return deltaMatch[1];

  // Fallback: extract any percentage
  const pctMatch = message.match(/(\d+)%/);
  if (pctMatch) return `${isHeal ? "+" : "-"}${pctMatch[1]}%`;

  return isHeal ? "+?%" : "-?%";
}

/**
 * Central animation orchestrator hook.
 *
 * Detects new battle log entries, maps them to animation events,
 * and queues them sequentially with appropriate timing.
 */
export function useBattleAnimations(state: BattleState): AnimationState {
  const [animState, setAnimState] = useState<AnimationState>(INITIAL_ANIMATION_STATE);
  // Start at current log length so we don't animate history on mount
  const lastLogLengthRef = useRef(state.fullLog.length);
  const mountedRef = useRef(false);
  const queueRef = useRef<AnimationEvent[]>([]);
  const isProcessingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      // Queue empty — clear all animations
      if (queueRef.current.length === 0) {
        setAnimState(INITIAL_ANIMATION_STATE);
      }
      return;
    }

    isProcessingRef.current = true;
    const event = queueRef.current.shift()!;

    // Apply this event's animation
    setAnimState((prev) => {
      const next: AnimationState = {
        slotAnimations: { ...prev.slotAnimations },
        moveFlash: event.moveFlash || null,
        effectivenessFlash: event.effectivenessFlash || null,
        damageNumbers: event.damageNumber ? [event.damageNumber] : [],
        isAnimating: true,
      };

      if (event.slotKey && event.cssClass) {
        next.slotAnimations[event.slotKey] = event.cssClass;
      }

      return next;
    });

    // After the animation duration, clear and process next
    timeoutRef.current = setTimeout(() => {
      isProcessingRef.current = false;

      // Clear the animation for this event's slot
      if (event.slotKey) {
        setAnimState((prev) => {
          const next = { ...prev };
          next.slotAnimations = { ...prev.slotAnimations };
          delete next.slotAnimations[event.slotKey!];
          return next;
        });
      }

      processQueue();
    }, event.duration);
  }, []);

  // Detect new log entries and queue animations
  useEffect(() => {
    // Skip the initial mount — lastLogLengthRef is already set to current length
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastLogLengthRef.current = state.fullLog.length;
      return;
    }

    const fullLog = state.fullLog;
    const prevLength = lastLogLengthRef.current;

    if (fullLog.length > prevLength) {
      const newEntries = fullLog.slice(prevLength);
      lastLogLengthRef.current = fullLog.length;

      for (const entry of newEntries) {
        const anim = logEntryToAnimation(entry);
        if (anim) {
          queueRef.current.push(anim);
        }
      }

      // Safety valve: force-clear isAnimating after 5s in case the queue gets stuck
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = setTimeout(() => {
        if (isProcessingRef.current || queueRef.current.length > 0) {
          queueRef.current = [];
          isProcessingRef.current = false;
          setAnimState(INITIAL_ANIMATION_STATE);
        }
      }, 5000);

      // Start processing if not already
      if (!isProcessingRef.current) {
        processQueue();
      }
    }
  }, [state.fullLog, state.fullLog.length, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  return animState;
}
