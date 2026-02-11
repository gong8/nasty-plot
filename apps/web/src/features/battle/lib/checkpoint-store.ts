import type { BattleCheckpoint } from "@nasty-plot/battle-engine"

const STORAGE_KEY = "nasty-plot:battle-checkpoint"
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Save a battle checkpoint to localStorage.
 * Returns true if saved successfully, false on quota/error.
 */
export function saveCheckpoint(checkpoint: BattleCheckpoint): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoint))
    return true
  } catch {
    return false
  }
}

/**
 * Load a battle checkpoint from localStorage.
 * Returns null if no checkpoint, expired, corrupted, or wrong version.
 */
export function loadCheckpoint(): BattleCheckpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)

    // Version check
    if (parsed.version !== 1) {
      clearCheckpoint()
      return null
    }

    // Structural validation
    if (
      typeof parsed.savedAt !== "number" ||
      !parsed.serializedBattle ||
      !parsed.battleState ||
      !parsed.config ||
      !parsed.config.playerTeam ||
      !parsed.config.opponentTeam
    ) {
      clearCheckpoint()
      return null
    }

    // Expiry check
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearCheckpoint()
      return null
    }

    return parsed as BattleCheckpoint
  } catch {
    clearCheckpoint()
    return null
  }
}

/**
 * Remove the stored checkpoint.
 */
export function clearCheckpoint(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

/**
 * Check if a valid (non-expired) checkpoint exists without fully parsing it.
 */
export function hasCheckpoint(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false

    const parsed = JSON.parse(raw)
    if (parsed.version !== 1) return false
    if (typeof parsed.savedAt !== "number") return false
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return false

    return true
  } catch {
    return false
  }
}
