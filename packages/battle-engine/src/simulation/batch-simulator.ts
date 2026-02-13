import { runAutomatedBattle, type SingleBattleResult } from "./automated-battle-manager"
import { RandomAI } from "../ai/random-ai"
import { GreedyAI } from "../ai/greedy-ai"
import { HeuristicAI } from "../ai/heuristic-ai"
import { MCTSAI } from "../ai/mcts-ai"
import type {
  AIPlayer,
  AIDifficulty,
  BatchSimConfig,
  PokemonStats,
  BatchAnalytics,
  BatchSimProgress,
} from "../types"

export type { BatchSimConfig, PokemonStats, BatchAnalytics, BatchSimProgress }

function createAI(difficulty: AIDifficulty): AIPlayer {
  switch (difficulty) {
    case "random":
      return new RandomAI()
    case "greedy":
      return new GreedyAI()
    case "heuristic":
      return new HeuristicAI()
    case "expert":
      return new MCTSAI({ maxIterations: 2000, maxTimeMs: 1000 })
  }
}

/**
 * Run a batch simulation of N games between two teams.
 *
 * Uses cooperative async scheduling (not Web Workers) since @pkmn/sim
 * uses Node streams. Runs up to `concurrency` games at once.
 */
export async function runBatchSimulation(
  config: BatchSimConfig,
  onProgress?: (progress: BatchSimProgress) => void,
): Promise<{ results: SingleBattleResult[]; analytics: BatchAnalytics }> {
  const concurrency = config.concurrency ?? 4
  const results: SingleBattleResult[] = []
  let team1Wins = 0
  let team2Wins = 0
  let draws = 0
  let completed = 0

  // Simple concurrency limiter
  const queue: Promise<void>[] = []
  let active = 0

  const runSingleGame = async (index: number) => {
    const ai1 = createAI(config.aiDifficulty)
    const ai2 = createAI(config.aiDifficulty)
    const seed = generateRandomSeed()

    try {
      const result = await runAutomatedBattle({
        formatId: config.formatId,
        simFormatId: config.simFormatId,
        gameType: config.gameType,
        team1Paste: config.team1Paste,
        team2Paste: config.team2Paste,
        team1Name: config.team1Name,
        team2Name: config.team2Name,
        ai1,
        ai2,
        maxTurns: 300,
        seed,
      })

      results[index] = result

      if (result.winner === "p1") team1Wins++
      else if (result.winner === "p2") team2Wins++
      else draws++
    } catch (err) {
      console.error(`[BatchSim] Game ${index} failed:`, err)
      draws++ // Count failures as draws
    }

    completed++
    onProgress?.({
      completed,
      total: config.totalGames,
      team1Wins,
      team2Wins,
      draws,
    })
  }

  // Run games with concurrency limit
  for (let i = 0; i < config.totalGames; i++) {
    const p = runSingleGame(i).then(() => {
      active--
    })
    queue.push(p)
    active++

    if (active >= concurrency) {
      await Promise.race(queue.filter(Boolean))
    }
  }

  await Promise.all(queue)

  const validResults = results.filter(Boolean)
  const analytics = computeAnalytics(validResults, config.totalGames, team1Wins, team2Wins, draws)

  return { results: validResults, analytics }
}

const TURN_BUCKET_SIZE = 5

function computeAnalytics(
  results: SingleBattleResult[],
  total: number,
  team1Wins: number,
  team2Wins: number,
  draws: number,
): BatchAnalytics {
  const turnCounts = results.map((r) => r.turnCount)
  const avgTurnCount =
    turnCounts.length > 0
      ? Math.round(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length)
      : 0

  const turnDistribution: Record<number, number> = {}
  for (const turns of turnCounts) {
    const bucket = Math.floor(turns / TURN_BUCKET_SIZE) * TURN_BUCKET_SIZE
    turnDistribution[bucket] = (turnDistribution[bucket] || 0) + 1
  }

  const pokemonStatsMap = new Map<string, PokemonStats>()

  for (const result of results) {
    const { finalState } = result

    for (const side of [finalState.sides.p1, finalState.sides.p2]) {
      for (const pokemon of side.team) {
        const key = pokemon.speciesId || pokemon.name
        if (!key) continue

        let stats = pokemonStatsMap.get(key)
        if (!stats) {
          stats = {
            pokemonId: key,
            name: pokemon.name,
            totalKOs: 0,
            totalFaints: 0,
            gamesAppeared: 0,
          }
          pokemonStatsMap.set(key, stats)
        }
        stats.gamesAppeared++
        if (pokemon.fainted) stats.totalFaints++
      }
    }
  }

  return {
    team1WinRate: toPercentage(team1Wins, total),
    team2WinRate: toPercentage(team2Wins, total),
    drawRate: toPercentage(draws, total),
    avgTurnCount,
    minTurnCount: turnCounts.length > 0 ? Math.min(...turnCounts) : 0,
    maxTurnCount: turnCounts.length > 0 ? Math.max(...turnCounts) : 0,
    pokemonStats: [...pokemonStatsMap.values()],
    turnDistribution,
  }
}

function toPercentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0
}

function generateRandomSeed(): [number, number, number, number] {
  return [
    (Math.random() * 0x10000) >>> 0,
    (Math.random() * 0x10000) >>> 0,
    (Math.random() * 0x10000) >>> 0,
    (Math.random() * 0x10000) >>> 0,
  ]
}
