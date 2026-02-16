import { processChunk } from "./protocol-parser.service"
import type { BattleState, BattleLogEntry } from "./types"

const PLAYER_ID_PATTERN = /^p[1-4]$/

/**
 * Deduplicate and process protocol lines into BattleLogEntries.
 *
 * @pkmn/sim sends the same protocol block to both sides (p1 sideupdate + p2 sideupdate).
 * This function skips identical consecutive chunks so events are processed exactly once.
 *
 * Returns the new entries produced and mutates state.
 */
export function processDeduplicatedProtocol(
  state: BattleState,
  protocolLines: string,
  lastChunkRef: { value: string },
  protocolLogRef: { value: string },
): BattleLogEntry[] {
  const trimmed = protocolLines.trim()
  if (!trimmed || trimmed === lastChunkRef.value) return []

  lastChunkRef.value = trimmed
  protocolLogRef.value += protocolLines
  return processChunk(state, protocolLines)
}

/**
 * Split a raw chunk from the BattleStream into protocol lines,
 * dispatching |request| and |error| lines via callbacks and accumulating
 * the rest for protocol processing.
 */
export function parseProtocolFromChunk(
  chunk: string,
  state: BattleState,
  lastChunkRef: { value: string },
  protocolLogRef: { value: string },
  onRequest: (requestJson: string) => void,
  onError: (errorMsg: string) => void,
): BattleLogEntry[] {
  const lines = chunk.split("\n")
  let protocolLines = ""
  const allEntries: BattleLogEntry[] = []

  for (const line of lines) {
    if (line.startsWith("|request|")) {
      allEntries.push(
        ...processDeduplicatedProtocol(state, protocolLines, lastChunkRef, protocolLogRef),
      )
      protocolLines = ""
      onRequest(line.slice(9))
      continue
    }

    if (line.startsWith("|error|")) {
      onError(line.slice(7))
      continue
    }

    // Skip stream markers -- these differ per player (sideupdate + p1/p2)
    // and break the deduplication check that prevents double-processing.
    if (line === "update" || line === "sideupdate" || PLAYER_ID_PATTERN.test(line)) {
      continue
    }

    protocolLines += line + "\n"
  }

  allEntries.push(
    ...processDeduplicatedProtocol(state, protocolLines, lastChunkRef, protocolLogRef),
  )
  return allEntries
}
