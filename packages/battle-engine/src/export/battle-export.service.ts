/**
 * Battle Export Service
 *
 * Formats battles for export in Showdown log and JSON formats.
 */

export interface BattleRecord {
  id: string
  formatId: string
  gameType: string
  mode: string
  team1Name: string
  team2Name: string
  team1Paste: string
  team2Paste: string
  winnerId: string | null
  turnCount: number
  protocolLog: string
  createdAt: string | Date
}

export interface ShowdownReplayJSON {
  id: string
  format: string
  players: [string, string]
  log: string
  uploadtime: number
  turns: number
  winner: string
}

/** Return raw protocol log text (already in Showdown format) */
export function formatShowdownLog(battle: BattleRecord): string {
  return battle.protocolLog
}

/** Format as structured Showdown replay JSON */
export function formatShowdownReplayJSON(battle: BattleRecord): ShowdownReplayJSON {
  let winner = ""
  if (battle.winnerId === "team1") winner = battle.team1Name
  else if (battle.winnerId === "team2") winner = battle.team2Name
  else if (battle.winnerId === "draw") winner = ""

  return {
    id: battle.id,
    format: battle.formatId,
    players: [battle.team1Name, battle.team2Name],
    log: battle.protocolLog,
    uploadtime: Math.floor(
      (battle.createdAt instanceof Date
        ? battle.createdAt.getTime()
        : new Date(battle.createdAt).getTime()) / 1000,
    ),
    turns: battle.turnCount,
    winner,
  }
}
