"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { BattleState } from "@nasty-plot/battle-engine"

interface BattleStateContextValue {
  battleState: BattleState | null
  setBattleState: (state: BattleState | null) => void
}

const BattleStateCtx = createContext<BattleStateContextValue>({
  battleState: null,
  setBattleState: () => {},
})

export function useBattleStateContext() {
  return useContext(BattleStateCtx)
}

/**
 * Hook for battle pages to publish their current state.
 * Automatically cleans up when the component unmounts.
 */
export function useBattleStatePublisher(state: BattleState | null) {
  const { setBattleState } = useBattleStateContext()
  useEffect(() => {
    setBattleState(state)
    return () => setBattleState(null)
  }, [state, setBattleState])
}

export function BattleStateProvider({ children }: { children: ReactNode }) {
  const [battleState, setBattleStateRaw] = useState<BattleState | null>(null)
  const setBattleState = useCallback((s: BattleState | null) => setBattleStateRaw(s), [])

  return (
    <BattleStateCtx.Provider value={{ battleState, setBattleState }}>
      {children}
    </BattleStateCtx.Provider>
  )
}
