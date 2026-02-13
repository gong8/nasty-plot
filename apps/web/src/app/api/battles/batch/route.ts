import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../lib/api-error"
import { prisma } from "@nasty-plot/db"
import { runBatchSimulation } from "@nasty-plot/battle-engine"
import type { AIDifficulty } from "@nasty-plot/battle-engine"
import type { GameType } from "@nasty-plot/core"
import { parseShowdownPaste } from "@nasty-plot/core"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
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

    if (!formatId || !team1Paste || !team2Paste || !totalGames) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate both teams have valid Pokemon with moves
    const pasteErrors: string[] = []
    for (const [label, paste] of [
      ["Team 1", team1Paste],
      ["Team 2", team2Paste],
    ] as const) {
      const parsed = parseShowdownPaste(paste)
      if (parsed.length === 0) {
        pasteErrors.push(`${label}: could not parse team`)
        continue
      }
      for (const slot of parsed) {
        if (!slot.pokemonId) continue
        const moves = slot.moves?.filter(Boolean) ?? []
        if (moves.length === 0) {
          pasteErrors.push(`${label}: ${slot.pokemonId} needs at least 1 move`)
        }
      }
    }
    if (pasteErrors.length > 0) {
      return NextResponse.json({ error: pasteErrors.join("; ") }, { status: 400 })
    }

    const MAX_BATCH_GAMES = 500
    const games = Math.min(totalGames, MAX_BATCH_GAMES)
    const resolvedGameType = gameType || "singles"
    const resolvedDifficulty = aiDifficulty || "heuristic"
    const resolvedTeam1Name = team1Name || "Team 1"
    const resolvedTeam2Name = team2Name || "Team 2"

    // Create the batch record
    const batch = await prisma.batchSimulation.create({
      data: {
        formatId,
        gameType: resolvedGameType,
        aiDifficulty: resolvedDifficulty,
        team1Paste,
        team1Name: resolvedTeam1Name,
        team2Paste,
        team2Name: resolvedTeam2Name,
        totalGames: games,
        status: "running",
      },
    })

    // Run simulation (fire-and-forget, update DB when done)
    runBatchSimulation(
      {
        formatId,
        simFormatId: simFormatId || undefined,
        gameType: resolvedGameType as GameType,
        aiDifficulty: resolvedDifficulty as AIDifficulty,
        team1Paste,
        team2Paste,
        team1Name: resolvedTeam1Name,
        team2Name: resolvedTeam2Name,
        totalGames: games,
      },
      async (progress) => {
        // Update progress periodically (every 10 games)
        if (progress.completed % 10 === 0 || progress.completed === games) {
          await prisma.batchSimulation
            .update({
              where: { id: batch.id },
              data: {
                completedGames: progress.completed,
                team1Wins: progress.team1Wins,
                team2Wins: progress.team2Wins,
                draws: progress.draws,
              },
            })
            .catch(() => {})
        }
      },
    )
      .then(async ({ analytics }) => {
        await prisma.batchSimulation.update({
          where: { id: batch.id },
          data: {
            status: "completed",
            completedGames: games,
            analytics: JSON.stringify(analytics),
          },
        })
      })
      .catch(async (err) => {
        console.error("[BatchSim] Error:", err)
        await prisma.batchSimulation
          .update({
            where: { id: batch.id },
            data: { status: "completed" },
          })
          .catch(() => {})
      })

    return NextResponse.json({ id: batch.id, status: "running" }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/battles/batch]", err)
    return apiErrorResponse(err, { fallback: "Failed to start batch simulation" })
  }
}
