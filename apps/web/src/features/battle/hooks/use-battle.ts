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
  type AIDifficulty,
  type AIPlayer,
  type BattleCheckpoint,
} from "@nasty-plot/battle-engine"
import type { GameType } from "@nasty-plot/core"
import { saveCheckpoint, clearCheckpoint } from "@/features/battle/lib/checkpoint-store"
import { postJson } from "@/lib/api-client"

interface UseBattleConfig {
  playerTeamPaste: string
  opponentTeamPaste: string
  formatId: string
  simFormatId?: string
  gameType: GameType
  aiDifficulty: AIDifficulty
  playerName?: string
  opponentName?: string
  playerTeamId?: string | null
  opponentTeamId?: string | null
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
  const checkpointExtrasRef = useRef<(() => Partial<BattleCheckpoint>) | null>(null)

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
    clearCheckpoint()

    // Cleanup previous battle
    managerRef.current?.destroy()

    const manager = new BattleManager({
      formatId: config.formatId,
      simFormatId: config.simFormatId,
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

      // Auto-save checkpoint when waiting for player choice
      if (newState.waitingForChoice && newState.phase === "battle") {
        const cp = manager.getCheckpoint(config.aiDifficulty)
        if (cp) {
          const extras = checkpointExtrasRef.current?.()
          saveCheckpoint(extras ? { ...cp, ...extras } : cp)
        }
      }

      // Clear checkpoint when battle ends
      if (newState.phase === "ended") {
        clearCheckpoint()
      }
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

  const withManagerAction = useCallback(
    async (action: (manager: BattleManager) => Promise<void>, errorLabel: string) => {
      const manager = managerRef.current
      if (!manager) return

      setIsLoading(true)
      try {
        await action(manager)
        setState({ ...manager.getState() })
      } catch (err) {
        setError(err instanceof Error ? err.message : errorLabel)
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const chooseLead = useCallback(
    async (leadOrder: number[]) => {
      await withManagerAction((m) => m.chooseLead(leadOrder), "Failed to choose lead")
    },
    [withManagerAction],
  )

  const submitMove = useCallback(
    async (moveIndex: number, tera?: boolean, targetSlot?: number) => {
      await withManagerAction(
        (m) => m.submitAction({ type: "move", moveIndex, tera, targetSlot }),
        "Failed to submit move",
      )
    },
    [withManagerAction],
  )

  const submitSwitch = useCallback(
    async (pokemonIndex: number) => {
      await withManagerAction(
        (m) => m.submitAction({ type: "switch", pokemonIndex }),
        "Failed to submit switch",
      )
    },
    [withManagerAction],
  )

  const rematch = useCallback(async () => {
    if (!configRef.current) return
    await startBattle(configRef.current)
  }, [startBattle])

  const resumeBattle = useCallback(async (checkpoint: BattleCheckpoint) => {
    setIsLoading(true)
    setError(null)

    // Cleanup previous battle
    managerRef.current?.destroy()

    // Reconstruct config for rematch support
    configRef.current = {
      playerTeamPaste: checkpoint.config.playerTeam,
      opponentTeamPaste: checkpoint.config.opponentTeam,
      formatId: checkpoint.config.formatId,
      simFormatId: checkpoint.config.simFormatId,
      gameType: checkpoint.config.gameType,
      aiDifficulty: checkpoint.aiDifficulty,
      playerName: checkpoint.config.playerName,
      opponentName: checkpoint.config.opponentName,
    }

    try {
      const ai = createAI(checkpoint.aiDifficulty)
      const manager = await BattleManager.resume(checkpoint, ai, (newState) => {
        setState({ ...newState })

        if (newState.waitingForChoice && newState.phase === "battle") {
          const cp = manager.getCheckpoint(checkpoint.aiDifficulty)
          if (cp) saveCheckpoint(cp)
        }

        if (newState.phase === "ended") {
          clearCheckpoint()
        }
      })

      managerRef.current = manager
      setState({ ...manager.getState() })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume battle")
      clearCheckpoint()
      console.error("[useBattle] Resume error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Save the completed battle to the database.
   */
  const saveBattle = useCallback(
    async (
      commentary?: Record<number, string>,
      chatSessionId?: string | null,
    ): Promise<string | null> => {
      const manager = managerRef.current
      const config = configRef.current
      if (!manager || !config || state.phase !== "ended") return null

      try {
        const protocolLog = manager.getProtocolLog()
        const winnerId = state.winner === "p1" ? "team1" : state.winner === "p2" ? "team2" : null

        const data = await postJson<{ id: string }>("/api/battles", {
          formatId: config.formatId,
          gameType: config.gameType,
          mode: "play",
          aiDifficulty: config.aiDifficulty,
          team1Paste: config.playerTeamPaste,
          team1Name: config.playerName || "Player",
          team2Paste: config.opponentTeamPaste,
          team2Name: config.opponentName || "Opponent",
          team1Id: config.playerTeamId || null,
          team2Id: config.opponentTeamId || null,
          winnerId,
          turnCount: state.turn,
          protocolLog,
          commentary: commentary ?? null,
          chatSessionId: chatSessionId ?? null,
        })
        return data.id
      } catch (err) {
        console.error("[useBattle] Save error:", err)
        return null
      }
    },
    [state],
  )

  const setCheckpointExtras = useCallback((getter: (() => Partial<BattleCheckpoint>) | null) => {
    checkpointExtrasRef.current = getter
  }, [])

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
    resumeBattle,
    setCheckpointExtras,
  }
}
