import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"
import { importFromReplayUrl, importFromRawLog } from "@nasty-plot/battle-engine"
import { findMatchingTeams, createTeamFromExtractedData } from "@nasty-plot/teams"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { replayUrl, rawLog, autoMatchTeams = true, autoCreateTeams = true } = body

    if (!replayUrl && !rawLog) {
      return NextResponse.json({ error: "Either replayUrl or rawLog is required" }, { status: 400 })
    }

    // Parse the battle data
    const parsed = replayUrl ? await importFromReplayUrl(replayUrl) : importFromRawLog(rawLog)

    // Team matching
    const teamMatching: {
      team1: {
        action: string
        teamId: string | null
        teamName: string | null
        confidence: number | null
      }
      team2: {
        action: string
        teamId: string | null
        teamName: string | null
        confidence: number | null
      }
    } = {
      team1: { action: "skipped", teamId: null, teamName: null, confidence: null },
      team2: { action: "skipped", teamId: null, teamName: null, confidence: null },
    }

    let team1Id: string | null = null
    let team2Id: string | null = null

    // Match/create team 1
    if (autoMatchTeams && parsed.team1.pokemon.length > 0) {
      const matches = await findMatchingTeams(parsed.team1.pokemon, parsed.formatId)
      if (matches.length > 0 && matches[0].confidence >= 60) {
        team1Id = matches[0].teamId
        teamMatching.team1 = {
          action: "matched",
          teamId: matches[0].teamId,
          teamName: matches[0].teamName,
          confidence: matches[0].confidence,
        }
      } else if (autoCreateTeams) {
        const created = await createTeamFromExtractedData(parsed.team1, parsed.formatId)
        team1Id = created.id
        teamMatching.team1 = {
          action: "created",
          teamId: created.id,
          teamName: created.name,
          confidence: null,
        }
      }
    }

    // Match/create team 2
    if (autoMatchTeams && parsed.team2.pokemon.length > 0) {
      const matches = await findMatchingTeams(parsed.team2.pokemon, parsed.formatId)
      if (matches.length > 0 && matches[0].confidence >= 60) {
        team2Id = matches[0].teamId
        teamMatching.team2 = {
          action: "matched",
          teamId: matches[0].teamId,
          teamName: matches[0].teamName,
          confidence: matches[0].confidence,
        }
      } else if (autoCreateTeams) {
        const created = await createTeamFromExtractedData(parsed.team2, parsed.formatId)
        team2Id = created.id
        teamMatching.team2 = {
          action: "created",
          teamId: created.id,
          teamName: created.name,
          confidence: null,
        }
      }
    }

    // Ensure Format record exists
    await prisma.format.upsert({
      where: { id: parsed.formatId },
      update: {},
      create: {
        id: parsed.formatId,
        name: parsed.formatId,
        generation: parseInt(parsed.formatId.replace(/[^0-9]/g, "").charAt(0) || "9"),
        gameType: parsed.gameType,
        isActive: true,
      },
    })

    // Create battle record
    const battle = await prisma.battle.create({
      data: {
        formatId: parsed.formatId,
        gameType: parsed.gameType,
        mode: "imported",
        team1Paste: parsed.team1.pokemon.map((p) => p.species).join(", "),
        team1Name: parsed.playerNames[0],
        team2Paste: parsed.team2.pokemon.map((p) => p.species).join(", "),
        team2Name: parsed.playerNames[1],
        team1Id,
        team2Id,
        winnerId:
          parsed.winnerId === "p1" ? "team1" : parsed.winnerId === "p2" ? "team2" : parsed.winnerId,
        turnCount: parsed.turnCount,
        protocolLog: parsed.protocolLog,
      },
    })

    return NextResponse.json(
      {
        battle: {
          id: battle.id,
          formatId: battle.formatId,
          team1Name: battle.team1Name,
          team2Name: battle.team2Name,
          team1Id: battle.team1Id,
          team2Id: battle.team2Id,
          winnerId: battle.winnerId,
          turnCount: battle.turnCount,
        },
        teamMatching,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error("[POST /api/battles/import]", err)
    const message = err instanceof Error ? err.message : "Failed to import battle"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
