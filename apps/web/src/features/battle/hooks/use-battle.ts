"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  BattleManager,
  createInitialState,
  RandomAI,
  GreedyAI,
  HeuristicAI,
} from "@nasty-plot/battle-engine";
import type {
  BattleState,
  BattleFormat,
  AIDifficulty,
  BattleLogEntry,
  AIPlayer,
} from "@nasty-plot/battle-engine";

interface UseBattleConfig {
  playerTeamPaste: string;
  opponentTeamPaste: string;
  formatId: string;
  gameType: BattleFormat;
  aiDifficulty: AIDifficulty;
  playerName?: string;
  opponentName?: string;
}

function createAI(difficulty: AIDifficulty): AIPlayer {
  switch (difficulty) {
    case "random": return new RandomAI();
    case "greedy": return new GreedyAI();
    case "heuristic": return new HeuristicAI();
  }
}

export function useBattle() {
  const [state, setState] = useState<BattleState>(
    createInitialState("idle", "singles")
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const managerRef = useRef<BattleManager | null>(null);
  const configRef = useRef<UseBattleConfig | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  const startBattle = useCallback(async (config: UseBattleConfig) => {
    setIsLoading(true);
    setError(null);
    configRef.current = config;

    try {
      // Cleanup previous battle
      managerRef.current?.destroy();

      const manager = new BattleManager({
        formatId: config.formatId,
        gameType: config.gameType,
        playerTeam: config.playerTeamPaste,
        opponentTeam: config.opponentTeamPaste,
        playerName: config.playerName || "Player",
        opponentName: config.opponentName || "Opponent",
      });

      // Set AI
      const ai = createAI(config.aiDifficulty);
      manager.setAI(ai);

      // Set up state update handler
      manager.onUpdate((newState) => {
        setState({ ...newState });
      });

      managerRef.current = manager;

      // Start the battle
      await manager.start();

      // Update state after start
      setState({ ...manager.getState() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start battle");
      console.error("[useBattle] Start error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const chooseLead = useCallback(async (leadOrder: number[]) => {
    const manager = managerRef.current;
    if (!manager) return;

    setIsLoading(true);
    try {
      await manager.chooseLead(leadOrder);
      setState({ ...manager.getState() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to choose lead");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitMove = useCallback(async (moveIndex: number, tera?: boolean) => {
    const manager = managerRef.current;
    if (!manager) return;

    setIsLoading(true);
    try {
      await manager.submitAction({
        type: "move",
        moveIndex,
        tera,
      });
      setState({ ...manager.getState() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit move");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitSwitch = useCallback(async (pokemonIndex: number) => {
    const manager = managerRef.current;
    if (!manager) return;

    setIsLoading(true);
    try {
      await manager.submitAction({
        type: "switch",
        pokemonIndex,
      });
      setState({ ...manager.getState() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit switch");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rematch = useCallback(async () => {
    if (!configRef.current) return;
    await startBattle(configRef.current);
  }, [startBattle]);

  return {
    state,
    isLoading,
    error,
    startBattle,
    chooseLead,
    submitMove,
    submitSwitch,
    rematch,
  };
}
