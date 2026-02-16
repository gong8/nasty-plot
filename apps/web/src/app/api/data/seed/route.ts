import { NextRequest, NextResponse } from "next/server"
import { getErrorMessage } from "../../../../lib/api-error"
import { syncUsageStats, syncSmogonSets } from "@nasty-plot/smogon-data"
import { isStale } from "@nasty-plot/data-pipeline"
import { FORMAT_DEFINITIONS, getActiveFormats } from "@nasty-plot/formats"
import { ensureFormatExists } from "@nasty-plot/formats/db"
import type { GameType } from "@nasty-plot/core"
import { seedSchema } from "../../../../lib/schemas/data.schemas"

interface SeedableFormat {
  id: string
  name: string
  generation: number
  gameType: GameType
  smogonStatsId?: string
  pkmnSetsId?: string
}

const DEFAULT_FORMATS: SeedableFormat[] = getActiveFormats()
  .slice(0, 6)
  .map((f) => ({
    id: f.id,
    name: f.name,
    generation: f.generation,
    gameType: f.gameType,
    smogonStatsId: f.smogonStatsId,
    pkmnSetsId: f.pkmnSetsId,
  }))

function resolveFormats(formatId?: string): SeedableFormat[] {
  if (!formatId) return DEFAULT_FORMATS

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
}

async function seedFormat(format: SeedableFormat, force: boolean) {
  try {
    await ensureFormatExists(format.id, format.generation, format.gameType)
  } catch {
    // Format may already exist, that's fine
  }

  const errors: string[] = []
  let statsOk = true
  let setsOk = true

  try {
    if (force || (await isStale("smogon-stats", format.id))) {
      await syncUsageStats(format.id, { smogonStatsId: format.smogonStatsId })
    }
  } catch (error) {
    statsOk = false
    errors.push(`stats: ${getErrorMessage(error)}`)
  }

  try {
    if (force || (await isStale("smogon-sets", format.id))) {
      await syncSmogonSets(format.id, { pkmnSetsId: format.pkmnSetsId })
    }
  } catch (error) {
    setsOk = false
    errors.push(`sets: ${getErrorMessage(error)}`)
  }

  return { format: format.id, statsOk, setsOk, errors }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.SEED_SECRET
  const isDevelopment = process.env.NODE_ENV === "development"

  // Fail closed: only skip auth when explicitly in development AND no SEED_SECRET is configured.
  // In production or when SEED_SECRET is set, always require a valid Bearer token.
  const skipAuth = isDevelopment && !expectedToken
  if (!skipAuth) {
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  console.warn(`[Seed] Data seed triggered at ${new Date().toISOString()}`)

  let raw: unknown = {}
  try {
    raw = await request.json()
  } catch {
    // empty body is fine, seed all formats
  }

  const result = seedSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: result.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const { formatId, force } = result.data
  const formats = resolveFormats(formatId)

  const results = []
  for (const format of formats) {
    results.push(await seedFormat(format, force))
  }

  let successes = 0
  let partial = 0
  let failures = 0
  for (const r of results) {
    if (r.statsOk && r.setsOk) successes++
    else if (!r.statsOk && !r.setsOk) failures++
    else partial++
  }

  return NextResponse.json(
    {
      data: results.map((r) => ({
        format: r.format,
        success: r.statsOk && r.setsOk,
        error: r.errors.length > 0 ? r.errors.join("; ") : undefined,
      })),
      meta: { total: results.length, successes, partial, failures },
    },
    { status: failures === 0 && partial === 0 ? 200 : 207 },
  )
}
