import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"
import { runBatchSimulation } from "@nasty-plot/battle-engine"
import type { AIDifficulty, BattleFormat } from "@nasty-plot/battle-engine"

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

    const games = Math.min(totalGames, 500) // Cap at 500

    // Create the batch record
    const batch = await prisma.batchSimulation.create({
      data: {
        formatId,
        gameType: gameType || "singles",
        aiDifficulty: aiDifficulty || "heuristic",
        team1Paste,
        team1Name: team1Name || "Team 1",
        team2Paste,
        team2Name: team2Name || "Team 2",
        totalGames: games,
        status: "running",
      },
    })

    // Run simulation (fire-and-forget, update DB when done)
    runBatchSimulation(
      {
        formatId,
        simFormatId: simFormatId || undefined,
        gameType: (gameType || "singles") as BattleFormat,
        aiDifficulty: (aiDifficulty || "heuristic") as AIDifficulty,
        team1Paste,
        team2Paste,
        team1Name: team1Name || "Team 1",
        team2Name: team2Name || "Team 2",
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
    return NextResponse.json({ error: "Failed to start batch simulation" }, { status: 500 })
  }
}
