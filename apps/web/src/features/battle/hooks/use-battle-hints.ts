"use client";

import { useState, useEffect, useMemo } from "react";
import {
  generateHints,
  estimateWinProbability,
  type BattleState,
  type HintResult,
  type WinProbability,
} from "@nasty-plot/battle-engine";

interface UseBattleHintsConfig {
  enabled: boolean;
}

export function useBattleHints(
  state: BattleState,
  config: UseBattleHintsConfig = { enabled: false },
) {
  const [hints, setHints] = useState<HintResult | null>(null);
  const [winProb, setWinProb] = useState<WinProbability | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Compute win probability every turn
  useEffect(() => {
    if (state.phase === "setup" || state.phase === "preview") return;

    try {
      const prob = estimateWinProbability(state);
      setWinProb(prob);
    } catch {
      // Evaluation may fail on incomplete states
    }
  }, [state.turn, state.phase, state.winner]);

  // Compute hints when waiting for choice and hints are enabled
  useEffect(() => {
    if (!config.enabled) {
      setHints(null);
      return;
    }

    if (!state.waitingForChoice || !state.availableActions) {
      setHints(null);
      return;
    }

    setIsAnalyzing(true);

    // Use requestAnimationFrame to avoid blocking the UI
    const id = requestAnimationFrame(() => {
      try {
        const result = generateHints(state, state.availableActions!, "p1");
        setHints(result);
      } catch (err) {
        console.error("[useBattleHints] Failed to generate hints:", err);
        setHints(null);
      } finally {
        setIsAnalyzing(false);
      }
    });

    return () => cancelAnimationFrame(id);
  }, [config.enabled, state.waitingForChoice, state.turn, state.availableActions]);

  return { hints, winProb, isAnalyzing };
}
