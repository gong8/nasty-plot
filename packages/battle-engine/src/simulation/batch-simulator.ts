import { toPercent } from "@nasty-plot/core"
import { runAutomatedBattle, type SingleBattleResult } from "./automated-battle-manager"
import { createAI } from "../ai/shared"
import type { BatchSimConfig, PokemonStats, BatchAnalytics, BatchSimProgress } from "../types"

export type { BatchSimConfig, PokemonStats, BatchAnalytics, BatchSimProgress }

/** MCTS config tuned for batch simulation (lower iterations for throughput). */
const BATCH_MCTS_CONFIG = { maxIterations: 2000, maxTimeMs: 1000 }

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

  const inflight = new Set<Promise<void>>()

  const runSingleGame = async (index: number) => {
    const ai1 = createAI(config.aiDifficulty, BATCH_MCTS_CONFIG)
    const ai2 = createAI(config.aiDifficulty, BATCH_MCTS_CONFIG)
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

  for (let i = 0; i < config.totalGames; i++) {
    const p = runSingleGame(i).then(() => inflight.delete(p))
    inflight.add(p)

    if (inflight.size >= concurrency) {
      await Promise.race(inflight)
    }
  }

  await Promise.all(inflight)

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
  const hasTurns = turnCounts.length > 0
  const avgTurnCount = hasTurns
    ? Math.round(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length)
    : 0

  const turnDistribution: Record<number, number> = {}
  for (const turns of turnCounts) {
    const bucket = Math.floor(turns / TURN_BUCKET_SIZE) * TURN_BUCKET_SIZE
    turnDistribution[bucket] = (turnDistribution[bucket] || 0) + 1
  }

  const pokemonStatsMap = new Map<string, PokemonStats>()

  for (const { finalState } of results) {
    for (const side of [finalState.sides.p1, finalState.sides.p2]) {
      for (const pokemon of side.team) {
        const key = pokemon.pokemonId || pokemon.name
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
    team1WinRate: toPercent(team1Wins, total),
    team2WinRate: toPercent(team2Wins, total),
    drawRate: toPercent(draws, total),
    avgTurnCount,
    minTurnCount: hasTurns ? Math.min(...turnCounts) : 0,
    maxTurnCount: hasTurns ? Math.max(...turnCounts) : 0,
    pokemonStats: [...pokemonStatsMap.values()],
    turnDistribution,
  }
}

function generateRandomSeed(): [number, number, number, number] {
  return [
    (Math.random() * 0x10000) >>> 0,
    (Math.random() * 0x10000) >>> 0,
    (Math.random() * 0x10000) >>> 0,
    (Math.random() * 0x10000) >>> 0,
  ]
}
