"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  BattleManager,
  createInitialState,
  RandomAI,
  GreedyAI,
  HeuristicAI,
  MCTSAI,
  type BattleState,
  type BattleFormat,
  type AIDifficulty,
  type BattleLogEntry,
  type AIPlayer,
} from "@nasty-plot/battle-engine"

interface UseBattleConfig {
  playerTeamPaste: string
  opponentTeamPaste: string
  formatId: string
  gameType: BattleFormat
  aiDifficulty: AIDifficulty
  playerName?: string
  opponentName?: string
}

function createAI(difficulty: AIDifficulty): AIPlayer {
  switch (difficulty) {
    case "random":
      return new RandomAI()
    case "greedy":
      return new GreedyAI()
    case "heuristic":
      return new HeuristicAI()
    case "expert":
      return new MCTSAI({ maxIterations: 5000, maxTimeMs: 3000 })
  }
}

export function useBattle() {
  const [state, setState] = useState<BattleState>(createInitialState("idle", "singles"))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const managerRef = useRef<BattleManager | null>(null)
  const configRef = useRef<UseBattleConfig | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.destroy()
    }
  }, [])

  const startBattle = useCallback(async (config: UseBattleConfig) => {
    setIsLoading(true)
    setError(null)
    configRef.current = config

    // Cleanup previous battle
    managerRef.current?.destroy()

    const manager = new BattleManager({
      formatId: config.formatId,
      gameType: config.gameType,
      playerTeam: config.playerTeamPaste,
      opponentTeam: config.opponentTeamPaste,
      playerName: config.playerName || "Player",
      opponentName: config.opponentName || "Opponent",
    })

    // Set AI
    const ai = createAI(config.aiDifficulty)
    manager.setAI(ai)

    // Set up state update handler
    manager.onUpdate((newState) => {
      setState({ ...newState })
    })

    managerRef.current = manager

    try {
      // Start the battle
      await manager.start()

      // If another startBattle call superseded us while we were awaiting, bail out
      if (managerRef.current !== manager) return

      // Update state after start
      setState({ ...manager.getState() })
    } catch (err) {
      // If another startBattle call superseded us, don't overwrite its state
      if (managerRef.current !== manager) return
      setError(err instanceof Error ? err.message : "Failed to start battle")
      console.error("[useBattle] Start error:", err)
    } finally {
      if (managerRef.current === manager) {
        setIsLoading(false)
      }
    }
  }, [])

  const chooseLead = useCallback(async (leadOrder: number[]) => {
    const manager = managerRef.current
    if (!manager) return

    setIsLoading(true)
    try {
      await manager.chooseLead(leadOrder)
      setState({ ...manager.getState() })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to choose lead")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const submitMove = useCallback(async (moveIndex: number, tera?: boolean, targetSlot?: number) => {
    const manager = managerRef.current
    if (!manager) return

    setIsLoading(true)
    try {
      await manager.submitAction({
        type: "move",
        moveIndex,
        tera,
        targetSlot,
      })
      setState({ ...manager.getState() })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit move")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const submitSwitch = useCallback(async (pokemonIndex: number) => {
    const manager = managerRef.current
    if (!manager) return

    setIsLoading(true)
    try {
      await manager.submitAction({
        type: "switch",
        pokemonIndex,
      })
      setState({ ...manager.getState() })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit switch")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const rematch = useCallback(async () => {
    if (!configRef.current) return
    await startBattle(configRef.current)
  }, [startBattle])

  /**
   * Save the completed battle to the database.
   */
  const saveBattle = useCallback(
    async (commentary?: Record<number, string>): Promise<string | null> => {
      const manager = managerRef.current
      const config = configRef.current
      if (!manager || !config || state.phase !== "ended") return null

      try {
        const protocolLog = manager.getProtocolLog()
        const winnerId = state.winner === "p1" ? "team1" : state.winner === "p2" ? "team2" : null

        const res = await fetch("/api/battles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formatId: config.formatId,
            gameType: config.gameType,
            mode: "play",
            aiDifficulty: config.aiDifficulty,
            team1Paste: config.playerTeamPaste,
            team1Name: config.playerName || "Player",
            team2Paste: config.opponentTeamPaste,
            team2Name: config.opponentName || "Opponent",
            winnerId,
            turnCount: state.turn,
            protocolLog,
            commentary: commentary ?? null,
          }),
        })

        if (!res.ok) throw new Error("Failed to save battle")
        const data = await res.json()
        return data.id
      } catch (err) {
        console.error("[useBattle] Save error:", err)
        return null
      }
    },
    [state],
  )

  return {
    state,
    isLoading,
    error,
    startBattle,
    chooseLead,
    submitMove,
    submitSwitch,
    rematch,
    saveBattle,
  }
}
