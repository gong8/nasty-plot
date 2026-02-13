import { prisma } from "@nasty-plot/db"

// --- Battle CRUD ---

export interface ListBattlesOptions {
  page?: number
  limit?: number
  teamId?: string | null
}

const BATTLE_LIST_SELECT = {
  id: true,
  formatId: true,
  gameType: true,
  mode: true,
  aiDifficulty: true,
  team1Name: true,
  team2Name: true,
  team1Id: true,
  team2Id: true,
  batchId: true,
  winnerId: true,
  turnCount: true,
  createdAt: true,
} as const

export async function listBattles(options: ListBattlesOptions = {}) {
  const { page = 1, limit = 20, teamId } = options
  const skip = (page - 1) * limit
  const where = teamId ? { OR: [{ team1Id: teamId }, { team2Id: teamId }] } : {}

  const [battles, total] = await Promise.all([
    prisma.battle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: BATTLE_LIST_SELECT,
    }),
    prisma.battle.count({ where }),
  ])

  return { battles, total, page, limit }
}

export interface CreateBattleData {
  formatId: string
  gameType?: string
  mode?: string
  aiDifficulty?: string | null
  team1Paste: string
  team1Name?: string
  team2Paste: string
  team2Name?: string
  team1Id?: string | null
  team2Id?: string | null
  winnerId?: string | null
  turnCount?: number
  protocolLog: string
  commentary?: unknown[] | null
  chatSessionId?: string | null
  turns?: {
    turnNumber: number
    team1Action: string
    team2Action: string
    stateSnapshot: string
    winProbTeam1?: number
  }[]
}

export async function createBattle(data: CreateBattleData) {
  return prisma.battle.create({
    data: {
      formatId: data.formatId,
      gameType: data.gameType || "singles",
      mode: data.mode || "play",
      aiDifficulty: data.aiDifficulty || null,
      team1Paste: data.team1Paste,
      team1Name: data.team1Name || "Player",
      team2Paste: data.team2Paste,
      team2Name: data.team2Name || "Opponent",
      team1Id: data.team1Id || null,
      team2Id: data.team2Id || null,
      winnerId: data.winnerId || null,
      turnCount: data.turnCount || 0,
      protocolLog: data.protocolLog,
      commentary: data.commentary ? JSON.stringify(data.commentary) : null,
      chatSessionId: data.chatSessionId || null,
      turns: data.turns?.length
        ? {
            create: data.turns.map((t) => ({
              turnNumber: t.turnNumber,
              team1Action: t.team1Action,
              team2Action: t.team2Action,
              stateSnapshot: t.stateSnapshot,
              winProbTeam1: t.winProbTeam1 ?? null,
            })),
          }
        : undefined,
    },
  })
}

export async function getBattle(battleId: string) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    include: { turns: { orderBy: { turnNumber: "asc" } } },
  })
}

export async function deleteBattle(battleId: string) {
  return prisma.battle.delete({ where: { id: battleId } })
}

export async function getBattleReplay(battleId: string) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    select: {
      id: true,
      formatId: true,
      gameType: true,
      team1Name: true,
      team2Name: true,
      winnerId: true,
      turnCount: true,
      protocolLog: true,
      commentary: true,
      chatSessionId: true,
      createdAt: true,
      turns: { orderBy: { turnNumber: "asc" } },
    },
  })
}

export async function getBattleForExport(battleId: string) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    select: {
      id: true,
      formatId: true,
      gameType: true,
      mode: true,
      team1Name: true,
      team2Name: true,
      team1Paste: true,
      team2Paste: true,
      winnerId: true,
      turnCount: true,
      protocolLog: true,
      createdAt: true,
    },
  })
}

export async function getBattleCommentary(battleId: string) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    select: { commentary: true },
  })
}

export async function updateBattleCommentary(battleId: string, commentary: string) {
  return prisma.battle.update({
    where: { id: battleId },
    data: { commentary },
    select: { commentary: true },
  })
}

// --- Batch Simulation CRUD ---

export interface CreateBatchData {
  formatId: string
  gameType: string
  aiDifficulty: string
  team1Paste: string
  team1Name: string
  team2Paste: string
  team2Name: string
  totalGames: number
}

export async function createBatchSimulation(data: CreateBatchData) {
  return prisma.batchSimulation.create({
    data: {
      ...data,
      status: "running",
    },
  })
}

export async function getBatchSimulation(batchId: string) {
  return prisma.batchSimulation.findUnique({ where: { id: batchId } })
}

export async function deleteBatchSimulation(batchId: string) {
  return prisma.batchSimulation.update({
    where: { id: batchId },
    data: { status: "cancelled" },
  })
}

export async function updateBatchProgress(
  batchId: string,
  progress: { completed: number; team1Wins: number; team2Wins: number; draws: number },
) {
  return prisma.batchSimulation
    .update({
      where: { id: batchId },
      data: {
        completedGames: progress.completed,
        team1Wins: progress.team1Wins,
        team2Wins: progress.team2Wins,
        draws: progress.draws,
      },
    })
    .catch(() => {})
}

export async function completeBatchSimulation(
  batchId: string,
  totalGames: number,
  analytics: string,
) {
  return prisma.batchSimulation.update({
    where: { id: batchId },
    data: {
      status: "completed",
      completedGames: totalGames,
      analytics,
    },
  })
}

export async function failBatchSimulation(batchId: string) {
  return prisma.batchSimulation
    .update({
      where: { id: batchId },
      data: { status: "completed" },
    })
    .catch(() => {})
}

// --- Team Battle Stats ---

export async function getTeamBattleStats(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } })
  if (!team) return null

  return prisma.battle.findMany({
    where: { OR: [{ team1Id: teamId }, { team2Id: teamId }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      formatId: true,
      gameType: true,
      mode: true,
      team1Name: true,
      team2Name: true,
      team1Paste: true,
      team2Paste: true,
      team1Id: true,
      team2Id: true,
      winnerId: true,
      turnCount: true,
      protocolLog: true,
      createdAt: true,
    },
  })
}
