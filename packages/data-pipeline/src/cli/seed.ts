#!/usr/bin/env tsx

import type { FormatDefinition } from "@nasty-plot/core"
import { prisma } from "@nasty-plot/db"
import { FORMAT_DEFINITIONS, getActiveFormats, ensureFormatExists } from "@nasty-plot/formats"
import { syncUsageStats, syncSmogonSets } from "@nasty-plot/smogon-data"
import { isStale } from "../staleness.service"
import { seedSampleTeams } from "../seed-sample-teams"

const ACTIVE_FORMATS = getActiveFormats()

interface SeedCliArgs {
  formatId?: string
  force: boolean
  statsOnly: boolean
  setsOnly: boolean
  teamsOnly: boolean
}

function parseArgs(): SeedCliArgs {
  const args = process.argv.slice(2)
  const result: SeedCliArgs = { force: false, statsOnly: false, setsOnly: false, teamsOnly: false }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      result.formatId = args[i + 1]
      i++
    } else if (args[i] === "--force") {
      result.force = true
    } else if (args[i] === "--stats-only") {
      result.statsOnly = true
    } else if (args[i] === "--sets-only") {
      result.setsOnly = true
    } else if (args[i] === "--teams-only") {
      result.teamsOnly = true
    }
  }

  const exclusiveFlags = [result.statsOnly, result.setsOnly, result.teamsOnly].filter(
    Boolean,
  ).length
  if (exclusiveFlags > 1) {
    console.error("[seed] Cannot combine --stats-only, --sets-only, and --teams-only")
    process.exit(1)
  }

  return result
}

interface SeedResult {
  format: string
  statsOk: boolean
  setsOk: boolean
  statsError?: string
  setsError?: string
}

async function logSyncError(source: string, formatId: string, message: string): Promise<void> {
  await prisma.dataSyncLog.upsert({
    where: { source_formatId: { source, formatId } },
    update: { lastSynced: new Date(), status: "error", message },
    create: { source, formatId, lastSynced: new Date(), status: "error", message },
  })
}

async function seedFormat(
  format: FormatDefinition,
  args: { force: boolean; statsOnly: boolean; setsOnly: boolean },
): Promise<SeedResult> {
  console.log(`\n--- Seeding ${format.name} (${format.id}) ---`)

  await ensureFormatExists(format.id, format.generation, format.gameType)

  const result: SeedResult = { format: format.id, statsOk: true, setsOk: true }

  // Fetch usage stats
  if (!args.setsOnly) {
    const statsStale = args.force || (await isStale("smogon-stats", format.id))
    if (statsStale) {
      console.log(`[seed] Fetching usage stats for ${format.id}...`)
      try {
        await syncUsageStats(format.id, { smogonStatsId: format.smogonStatsId })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[seed] Failed to fetch usage stats for ${format.id}: ${msg}`)
        result.statsOk = false
        result.statsError = msg
        await logSyncError("smogon-stats", format.id, msg)
      }
    } else {
      console.log(`[seed] Usage stats for ${format.id} are fresh, skipping.`)
    }
  }

  // Fetch Smogon sets (independent of stats — always attempt even if stats failed)
  if (!args.statsOnly) {
    const setsStale = args.force || (await isStale("smogon-sets", format.id))
    if (setsStale) {
      console.log(`[seed] Fetching Smogon sets for ${format.id}...`)
      try {
        await syncSmogonSets(format.id, {
          pkmnSetsId: format.pkmnSetsId,
          smogonStatsId: format.smogonStatsId,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[seed] Failed to fetch sets for ${format.id}: ${msg}`)
        result.setsOk = false
        result.setsError = msg
        await logSyncError("smogon-sets", format.id, msg)
      }
    } else {
      console.log(`[seed] Smogon sets for ${format.id} are fresh, skipping.`)
    }
  }

  return result
}

async function main(): Promise<void> {
  const args = parseArgs()

  console.log("=== Nasty Plot Data Seeder ===")
  if (args.force) console.log("Force mode: ignoring staleness checks")
  if (args.statsOnly) console.log("Stats only mode")
  if (args.setsOnly) console.log("Sets only mode")
  if (args.teamsOnly) console.log("Teams only mode")
  if (args.formatId) console.log(`Target format: ${args.formatId}`)

  // Teams-only mode: seed sample teams and exit
  if (args.teamsOnly) {
    const teamsResult = await seedSampleTeams(args.force)
    console.log("\n=== Seed Summary ===")
    if (teamsResult.skipped) {
      console.log("Sample teams: fresh (already seeded)")
    } else {
      console.log(`Sample teams: seeded ${teamsResult.seeded} teams`)
    }
    await prisma.$disconnect()
    return
  }

  let formatsToSeed = args.formatId
    ? ACTIVE_FORMATS.filter((f) => f.id === args.formatId)
    : ACTIVE_FORMATS

  if (formatsToSeed.length === 0 && args.formatId) {
    // Unknown format — look up from all definitions (including inactive)
    const definition = FORMAT_DEFINITIONS.find((f) => f.id === args.formatId)
    if (definition) {
      formatsToSeed = [definition]
      console.log(`[seed] Note: ${args.formatId} is inactive but seeding as requested`)
    } else {
      console.error(
        `[seed] Unknown format: ${args.formatId}. Available: ${ACTIVE_FORMATS.map((f) => f.id).join(", ")}`,
      )
      process.exit(1)
    }
  }

  const results: SeedResult[] = []

  for (const format of formatsToSeed) {
    try {
      const result = await seedFormat(format, args)
      results.push(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[seed] Unexpected error for ${format.id}: ${msg}`)
      results.push({
        format: format.id,
        statsOk: false,
        setsOk: false,
        statsError: msg,
        setsError: msg,
      })
    }
  }

  // Seed sample teams (global, not per-format)
  let teamsResult: { seeded: number; skipped: boolean } | undefined
  if (!args.statsOnly && !args.setsOnly) {
    teamsResult = await seedSampleTeams(args.force)
  }

  // Summary
  console.log("\n=== Seed Summary ===")
  const fullSuccess = results.filter((r) => r.statsOk && r.setsOk)
  const partialSuccess = results.filter((r) => (r.statsOk || r.setsOk) && !(r.statsOk && r.setsOk))
  const fullFailure = results.filter((r) => !r.statsOk && !r.setsOk)

  console.log(
    `Total: ${results.length} | OK: ${fullSuccess.length} | Partial: ${partialSuccess.length} | Failed: ${fullFailure.length}`,
  )

  for (const r of results) {
    if (r.statsOk && r.setsOk) {
      console.log(`  [OK]      ${r.format}`)
    } else if (!r.statsOk && !r.setsOk) {
      console.log(`  [FAIL]    ${r.format} — stats: ${r.statsError}; sets: ${r.setsError}`)
    } else {
      const detail = r.statsOk ? `sets failed: ${r.setsError}` : `stats failed: ${r.statsError}`
      console.log(`  [PARTIAL] ${r.format} — ${detail}`)
    }
  }

  if (teamsResult) {
    if (teamsResult.skipped) {
      console.log(`  [OK]      sample-teams (fresh)`)
    } else {
      console.log(`  [OK]      sample-teams (seeded ${teamsResult.seeded})`)
    }
  }

  await prisma.$disconnect()

  if (fullFailure.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
