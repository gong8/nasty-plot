// Chat context modes for context-locked sessions
export type ChatContextMode = "guided-builder" | "team-editor" | "battle-live" | "battle-replay"

export interface TeamChatContextData {
  teamId: string
  teamName: string
  formatId: string
  paste?: string
}

export interface BattleLiveChatContextData {
  formatId: string
  team1Name: string
  team2Name: string
  aiDifficulty?: string
}

export interface BattleReplayChatContextData {
  battleId: string
  formatId: string
  team1Name: string
  team2Name: string
  turnCount: number
  winnerId?: string
}

export type ChatContextData =
  | TeamChatContextData
  | BattleLiveChatContextData
  | BattleReplayChatContextData
