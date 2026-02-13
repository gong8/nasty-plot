import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../lib/api-error"
import { prisma } from "@nasty-plot/db"
import { importFromReplayUrl, importFromRawLog, createBattle } from "@nasty-plot/battle-engine"
import { findMatchingTeams, createTeamFromExtractedData } from "@nasty-plot/teams"
import { enrichExtractedTeam } from "@nasty-plot/smogon-data"

const MATCH_CONFIDENCE_THRESHOLD = 60

type TeamMatchResult = {
  action: string
  teamId: string | null
  teamName: string | null
  confidence: number | null
}

const SKIPPED_MATCH: TeamMatchResult = {
  action: "skipped",
  teamId: null,
  teamName: null,
  confidence: null,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      replayUrl,
      rawLog,
      autoMatchTeams = true,
      autoCreateTeams = true,
      inferSets = true,
    } = body

    if (!replayUrl && !rawLog) {
      return NextResponse.json({ error: "Either replayUrl or rawLog is required" }, { status: 400 })
    }

    // Parse the battle data
    const parsed = replayUrl ? await importFromReplayUrl(replayUrl) : importFromRawLog(rawLog)

    // Optionally enrich teams with inferred Smogon set data
    if (inferSets) {
      const [enriched1, enriched2] = await Promise.all([
        enrichExtractedTeam(parsed.team1, parsed.formatId),
        enrichExtractedTeam(parsed.team2, parsed.formatId),
      ])
      parsed.team1 = enriched1 as typeof parsed.team1
      parsed.team2 = enriched2 as typeof parsed.team2
    }

    // Match or create teams from extracted battle data
    async function matchOrCreateTeam(
      teamData: typeof parsed.team1,
      formatId: string,
    ): Promise<{ id: string | null; result: TeamMatchResult }> {
      if (!autoMatchTeams || teamData.pokemon.length === 0) {
        return { id: null, result: SKIPPED_MATCH }
      }

      const matches = await findMatchingTeams(teamData.pokemon, formatId)
      const bestMatch = matches[0]

      if (bestMatch && bestMatch.confidence >= MATCH_CONFIDENCE_THRESHOLD) {
        return {
          id: bestMatch.teamId,
          result: {
            action: "matched",
            teamId: bestMatch.teamId,
            teamName: bestMatch.teamName,
            confidence: bestMatch.confidence,
          },
        }
      }

      if (autoCreateTeams) {
        const created = await createTeamFromExtractedData(teamData, formatId)
        return {
          id: created.id,
          result: {
            action: "created",
            teamId: created.id,
            teamName: created.name,
            confidence: null,
          },
        }
      }

      return { id: null, result: SKIPPED_MATCH }
    }

    const [team1Match, team2Match] = await Promise.all([
      matchOrCreateTeam(parsed.team1, parsed.formatId),
      matchOrCreateTeam(parsed.team2, parsed.formatId),
    ])

    const team1Id = team1Match.id
    const team2Id = team2Match.id
    const teamMatching = { team1: team1Match.result, team2: team2Match.result }

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
    const battle = await createBattle({
      formatId: parsed.formatId,
      gameType: parsed.gameType,
      mode: "imported",
      team1Paste: parsed.team1.pokemon.map((p) => p.pokemonName).join(", "),
      team1Name: parsed.playerNames[0],
      team2Paste: parsed.team2.pokemon.map((p) => p.pokemonName).join(", "),
      team2Name: parsed.playerNames[1],
      team1Id,
      team2Id,
      winnerId:
        parsed.winnerId === "p1" ? "team1" : parsed.winnerId === "p2" ? "team2" : parsed.winnerId,
      turnCount: parsed.turnCount,
      protocolLog: parsed.protocolLog,
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
    return apiErrorResponse(err, { fallback: "Failed to import battle" })
  }
}
