import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse, badRequestResponse } from "../../../../lib/api-error"
import { runBatchSimulation } from "@nasty-plot/battle-engine"
import {
  createBatchSimulation,
  updateBatchProgress,
  completeBatchSimulation,
  failBatchSimulation,
} from "@nasty-plot/battle-engine/db"
import type { AIDifficulty } from "@nasty-plot/battle-engine"
import type { GameType } from "@nasty-plot/core"
import { parseShowdownPaste } from "@nasty-plot/core"
import { validateBody } from "../../../../lib/validation"
import { batchSimulationSchema } from "../../../../lib/schemas/battle.schemas"

const MAX_BATCH_GAMES = 500
const PROGRESS_INTERVAL = 10

export async function POST(req: NextRequest) {
  try {
    const [body, error] = await validateBody(req, batchSimulationSchema)
    if (error) return error

    const {
      formatId,
      simFormatId,
      gameType,
      aiDifficulty,
      team1Paste,
      team1Name,
      team2Paste,
      team2Name,
      totalGames,
    } = body

    const pasteErrors = validateTeamPastes([
      { label: "Team 1", paste: team1Paste },
      { label: "Team 2", paste: team2Paste },
    ])
    if (pasteErrors.length > 0) {
      return badRequestResponse(pasteErrors.join("; "))
    }

    const games = Math.min(totalGames, MAX_BATCH_GAMES)
    const resolvedGameType = (gameType || "singles") as GameType
    const resolvedDifficulty = (aiDifficulty || "heuristic") as AIDifficulty
    const resolvedTeam1Name = team1Name || "Team 1"
    const resolvedTeam2Name = team2Name || "Team 2"

    const batch = await createBatchSimulation({
      formatId,
      gameType: resolvedGameType,
      aiDifficulty: resolvedDifficulty,
      team1Paste,
      team1Name: resolvedTeam1Name,
      team2Paste,
      team2Name: resolvedTeam2Name,
      totalGames: games,
    })

    runBatchSimulation(
      {
        formatId,
        simFormatId: simFormatId || undefined,
        gameType: resolvedGameType,
        aiDifficulty: resolvedDifficulty,
        team1Paste,
        team2Paste,
        team1Name: resolvedTeam1Name,
        team2Name: resolvedTeam2Name,
        totalGames: games,
      },
      async (progress) => {
        if (progress.completed % PROGRESS_INTERVAL === 0 || progress.completed === games) {
          await updateBatchProgress(batch.id, {
            completed: progress.completed,
            team1Wins: progress.team1Wins,
            team2Wins: progress.team2Wins,
            draws: progress.draws,
          })
        }
      },
    )
      .then(async ({ analytics }) => {
        await completeBatchSimulation(batch.id, games, JSON.stringify(analytics))
      })
      .catch(async (err) => {
        console.error("[BatchSim] Error:", err)
        await failBatchSimulation(batch.id)
      })

    return NextResponse.json({ id: batch.id, status: "running" }, { status: 201 })
  } catch (err) {
    return apiErrorResponse(err, {
      fallback: "Failed to start batch simulation",
    })
  }
}

function validateTeamPastes(teams: Array<{ label: string; paste: string }>): string[] {
  const errors: string[] = []
  for (const { label, paste } of teams) {
    const parsed = parseShowdownPaste(paste)
    if (parsed.length === 0) {
      errors.push(`${label}: could not parse team`)
      continue
    }
    for (const slot of parsed) {
      if (!slot.pokemonId) continue
      const moves = slot.moves?.filter(Boolean) ?? []
      if (moves.length === 0) {
        errors.push(`${label}: ${slot.pokemonId} needs at least 1 move`)
      }
    }
  }
  return errors
}
