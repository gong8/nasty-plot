import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse, badRequestResponse } from "../../../../lib/api-error"
import { importFromReplayUrl, importFromRawLog } from "@nasty-plot/battle-engine"
import { createBattle } from "@nasty-plot/battle-engine/db"
import { ensureFormatExists } from "@nasty-plot/formats/db"
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
      return badRequestResponse("Either replayUrl or rawLog is required")
    }

    const parsed = replayUrl ? await importFromReplayUrl(replayUrl) : importFromRawLog(rawLog)

    if (inferSets) {
      const [enriched1, enriched2] = await Promise.all([
        enrichExtractedTeam(parsed.team1, parsed.formatId),
        enrichExtractedTeam(parsed.team2, parsed.formatId),
      ])
      parsed.team1 = enriched1 as typeof parsed.team1
      parsed.team2 = enriched2 as typeof parsed.team2
    }

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

    await ensureFormatExists(parsed.formatId)

    const pokemonNames = (team: typeof parsed.team1) =>
      team.pokemon.map((p) => p.pokemonName).join(", ")

    const PLAYER_SIDE_MAP: Record<string, string> = { p1: "team1", p2: "team2" }
    const winnerId = PLAYER_SIDE_MAP[parsed.winnerId] ?? parsed.winnerId

    const battle = await createBattle({
      formatId: parsed.formatId,
      gameType: parsed.gameType,
      mode: "imported",
      team1Paste: pokemonNames(parsed.team1),
      team1Name: parsed.playerNames[0],
      team2Paste: pokemonNames(parsed.team2),
      team2Name: parsed.playerNames[1],
      team1Id,
      team2Id,
      winnerId,
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
