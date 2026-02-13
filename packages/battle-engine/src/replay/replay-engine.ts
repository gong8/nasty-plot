import { createInitialState } from "../battle-manager"
import { processLine } from "../protocol-parser"
import { estimateWinProbability } from "../ai/win-probability"
import type { GameType } from "@nasty-plot/core"
import type { BattleState, BattleLogEntry } from "../types"

export interface ReplayFrame {
  turnNumber: number
  /** Deep clone of the state at this turn boundary */
  state: BattleState
  /** Log entries that occurred during this turn */
  entries: BattleLogEntry[]
  /** Win probability for team1 (p1) at this point, 0-100 */
  winProbTeam1: number | null
}

/**
 * ReplayEngine reconstructs battle state from a stored protocol log.
 *
 * Feeds the raw @pkmn/sim protocol through processLine() to rebuild
 * state at each turn boundary, producing frames for the replay viewer.
 */
export class ReplayEngine {
  private frames: ReplayFrame[] = []
  private currentIndex = 0
  private parsed = false

  constructor(
    private protocolLog: string,
    private format: GameType = "singles",
  ) {}

  /**
   * Parse the protocol log and build all replay frames.
   */
  parse(): void {
    if (this.parsed) return
    this.parsed = true

    const state = createInitialState("replay", this.format)
    const lines = this.protocolLog.split("\n").filter(Boolean)

    let currentTurnEntries: BattleLogEntry[] = []
    let lastTurnNumber = 0

    // Create initial frame (turn 0)
    this.frames.push(createFrame(state, 0, [], 50))

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip request lines, error lines, and stream markers for replay
      if (line.startsWith("|request|") || line.startsWith("|error|")) continue
      if (line === "update" || line === "sideupdate" || line === "p1" || line === "p2") continue

      // Handle |split|<side>: next line is owner view (exact HP),
      // line after is spectator view (percentage). Keep owner, skip spectator.
      if (line.startsWith("|split|")) {
        if (i + 1 < lines.length) {
          const ownerEntry = processLine(state, lines[i + 1])
          if (ownerEntry) {
            appendEntry(state, currentTurnEntries, ownerEntry)
            if (ownerEntry.type === "turn") {
              if (lastTurnNumber > 0 || currentTurnEntries.length > 1) {
                this.frames.push(createFrame(state, state.turn, currentTurnEntries))
              }
              currentTurnEntries = [ownerEntry]
              lastTurnNumber = state.turn
            }
            if (ownerEntry.type === "win") {
              this.frames.push(createFrame(state, state.turn, currentTurnEntries))
              currentTurnEntries = []
            }
          }
        }
        i += 2 // skip past owner + spectator lines
        continue
      }

      const entry = processLine(state, line)
      if (!entry) continue

      appendEntry(state, currentTurnEntries, entry)

      if (entry.type === "turn") {
        if (lastTurnNumber > 0 || currentTurnEntries.length > 1) {
          this.frames.push(createFrame(state, state.turn, currentTurnEntries))
        }
        currentTurnEntries = [entry]
        lastTurnNumber = state.turn
      }

      if (entry.type === "win") {
        this.frames.push(createFrame(state, state.turn, currentTurnEntries))
        currentTurnEntries = []
      }
    }

    if (
      currentTurnEntries.length > 0 &&
      this.frames[this.frames.length - 1]?.turnNumber !== state.turn
    ) {
      this.frames.push(createFrame(state, state.turn, currentTurnEntries))
    }

    this.currentIndex = 0
  }

  /** Get frame at a specific turn index (0-based frame index, not turn number). */
  getFrame(index: number): ReplayFrame | null {
    if (index < 0 || index >= this.frames.length) return null
    return this.frames[index]
  }

  /** Get frame by turn number. */
  getFrameByTurn(turn: number): ReplayFrame | null {
    return this.frames.find((f) => f.turnNumber === turn) || null
  }

  /** Advance to next frame and return it. */
  nextFrame(): ReplayFrame | null {
    if (this.currentIndex >= this.frames.length - 1) return null
    this.currentIndex++
    return this.frames[this.currentIndex]
  }

  /** Go back to previous frame and return it. */
  prevFrame(): ReplayFrame | null {
    if (this.currentIndex <= 0) return null
    this.currentIndex--
    return this.frames[this.currentIndex]
  }

  /** Get current frame index. */
  getCurrentIndex(): number {
    return this.currentIndex
  }

  /** Set current frame index. */
  setCurrentIndex(index: number): ReplayFrame | null {
    if (index < 0 || index >= this.frames.length) return null
    this.currentIndex = index
    return this.frames[index]
  }

  /** Get all frames (for win probability graph). */
  getAllFrames(): ReplayFrame[] {
    return this.frames
  }

  /** Total number of frames. */
  get totalFrames(): number {
    return this.frames.length
  }

  /** Maximum turn number. */
  get maxTurn(): number {
    return this.frames.length > 0 ? this.frames[this.frames.length - 1].turnNumber : 0
  }
}

function appendEntry(state: BattleState, turnEntries: BattleLogEntry[], entry: BattleLogEntry) {
  state.log.push(entry)
  state.fullLog.push(entry)
  turnEntries.push(entry)
}

function createFrame(
  state: BattleState,
  turnNumber: number,
  entries: BattleLogEntry[],
  defaultWinProb?: number,
): ReplayFrame {
  const cloned: BattleState = JSON.parse(JSON.stringify(state))
  let winProbTeam1: number | null = defaultWinProb ?? null
  if (defaultWinProb === undefined) {
    try {
      winProbTeam1 = estimateWinProbability(cloned).p1
    } catch {
      // eval may fail on incomplete state
    }
  }
  return {
    turnNumber,
    state: cloned,
    entries: [...entries],
    winProbTeam1,
  }
}
