import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"
import { fetchUsageStats, fetchSmogonSets } from "@nasty-plot/smogon-data"
import { isStale } from "@nasty-plot/data-pipeline"
import { FORMAT_DEFINITIONS } from "@nasty-plot/formats"

const DEFAULT_FORMATS = FORMAT_DEFINITIONS.filter((f) => f.isActive)
  .slice(0, 6)
  .map((f) => ({
    id: f.id,
    name: f.name,
    generation: f.generation,
    gameType: f.gameType,
    smogonStatsId: f.smogonStatsId,
    pkmnSetsId: f.pkmnSetsId,
  }))

export async function POST(request: NextRequest) {
  let body: { formatId?: string; force?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine, seed all formats
  }

  const { formatId, force = false } = body

  const formats = formatId
    ? (() => {
        const def = FORMAT_DEFINITIONS.find((f) => f.id === formatId)
        return [
          {
            id: formatId,
            name: def?.name ?? formatId,
            generation: def?.generation ?? 9,
            gameType: def?.gameType ?? "singles",
            smogonStatsId: def?.smogonStatsId,
            pkmnSetsId: def?.pkmnSetsId,
          },
        ]
      })()
    : DEFAULT_FORMATS

  const results: { format: string; statsOk: boolean; setsOk: boolean; errors: string[] }[] = []

  for (const format of formats) {
    // Upsert format
    try {
      await prisma.format.upsert({
        where: { id: format.id },
        update: {},
        create: {
          id: format.id,
          name: format.name,
          generation: format.generation,
          gameType: format.gameType,
          isActive: true,
        },
      })
    } catch {
      // Format may already exist, that's fine
    }

    const errors: string[] = []
    let statsOk = true
    let setsOk = true

    // Usage stats
    try {
      const statsNeedRefresh = force || (await isStale("smogon-stats", format.id))
      if (statsNeedRefresh) {
        await fetchUsageStats(format.id, { smogonStatsId: format.smogonStatsId })
      }
    } catch (err) {
      statsOk = false
      errors.push(`stats: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Smogon sets (independent of stats)
    try {
      const setsNeedRefresh = force || (await isStale("smogon-sets", format.id))
      if (setsNeedRefresh) {
        await fetchSmogonSets(format.id, { pkmnSetsId: format.pkmnSetsId })
      }
    } catch (err) {
      setsOk = false
      errors.push(`sets: ${err instanceof Error ? err.message : String(err)}`)
    }

    results.push({ format: format.id, statsOk, setsOk, errors })
  }

  const allSuccess = results.every((r) => r.statsOk && r.setsOk)
  return NextResponse.json(
    {
      data: results.map((r) => ({
        format: r.format,
        success: r.statsOk && r.setsOk,
        error: r.errors.length > 0 ? r.errors.join("; ") : undefined,
      })),
      meta: {
        total: results.length,
        successes: results.filter((r) => r.statsOk && r.setsOk).length,
        partial: results.filter((r) => (r.statsOk || r.setsOk) && !(r.statsOk && r.setsOk)).length,
        failures: results.filter((r) => !r.statsOk && !r.setsOk).length,
      },
    },
    { status: allSuccess ? 200 : 207 },
  )
}
