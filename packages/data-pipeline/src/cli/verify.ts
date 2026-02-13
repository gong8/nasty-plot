#!/usr/bin/env tsx

/**
 * Verify seeded data integrity against @pkmn/dex.
 *
 * Checks every Pokemon ID, ability, item, move, and nature stored in the DB
 * to confirm they resolve in @pkmn/dex for Gen 9. Reports issues by table
 * with enough detail to fix the seed pipeline or clean bad data.
 *
 * Usage:
 *   pnpm verify                  # full verification
 *   pnpm verify --format gen9ou  # single format
 *   pnpm verify --fix            # delete rows with unresolvable Pokemon IDs
 */

import { prisma } from "@nasty-plot/db"
import { getDex } from "@nasty-plot/pokemon-data"

const dex = getDex()

// ─── Types ───────────────────────────────────────────────────────────────────

interface Issue {
  table: string
  formatId: string
  pokemonId: string
  field: string
  value: string
  message: string
}

interface CliArgs {
  formatId?: string
  fix: boolean
}

// ─── CLI parsing ─────────────────────────────────────────────────────────────

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { fix: false }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      result.formatId = args[i + 1]
      i++
    } else if (args[i] === "--fix") {
      result.fix = true
    }
  }
  return result
}

// ─── Allowlists ──────────────────────────────────────────────────────────────

// Smogon uses "nothing" to mean "no item held" — valid in usage stats
const ALLOWED_ITEMS = new Set(["nothing"])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dexExists(
  category: "species" | "moves" | "items" | "abilities" | "natures",
  id: string,
): boolean {
  if (category === "items" && ALLOWED_ITEMS.has(id.toLowerCase())) return true
  const entry = dex[category].get(id)
  return !!(entry && entry.exists)
}

const speciesExists = (id: string) => dexExists("species", id)
const moveExists = (name: string) => dexExists("moves", name)
const itemExists = (name: string) => dexExists("items", name)
const abilityExists = (name: string) => dexExists("abilities", name)
const natureExists = (name: string) => dexExists("natures", name)

// ─── Verification checks ────────────────────────────────────────────────────

async function verifyUsageStats(
  formatFilter?: string,
): Promise<{ issues: Issue[]; total: number }> {
  const where = formatFilter ? { formatId: formatFilter } : {}
  const rows = await prisma.usageStats.findMany({
    where,
    select: { formatId: true, pokemonId: true },
    distinct: ["pokemonId", "formatId"],
  })

  const issues: Issue[] = []
  for (const row of rows) {
    if (!speciesExists(row.pokemonId)) {
      issues.push({
        table: "UsageStats",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "pokemonId",
        value: row.pokemonId,
        message: `Species "${row.pokemonId}" not found in @pkmn/dex`,
      })
    }
  }
  return { issues, total: rows.length }
}

async function verifySmogonSets(
  formatFilter?: string,
): Promise<{ issues: Issue[]; total: number }> {
  const where = formatFilter ? { formatId: formatFilter } : {}
  const rows = await prisma.smogonSet.findMany({ where })

  const issues: Issue[] = []
  for (const row of rows) {
    // Pokemon
    if (!speciesExists(row.pokemonId)) {
      issues.push({
        table: "SmogonSet",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "pokemonId",
        value: row.pokemonId,
        message: `Species "${row.pokemonId}" not found in @pkmn/dex`,
      })
      continue // skip further checks if species itself is bad
    }

    // Ability
    if (row.ability && !abilityExists(row.ability)) {
      issues.push({
        table: "SmogonSet",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "ability",
        value: row.ability,
        message: `Ability "${row.ability}" not found in @pkmn/dex`,
      })
    }

    // Item
    if (row.item && !itemExists(row.item)) {
      issues.push({
        table: "SmogonSet",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "item",
        value: row.item,
        message: `Item "${row.item}" not found in @pkmn/dex`,
      })
    }

    // Nature
    if (row.nature && !natureExists(row.nature)) {
      issues.push({
        table: "SmogonSet",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "nature",
        value: row.nature,
        message: `Nature "${row.nature}" not found in @pkmn/dex`,
      })
    }

    // Moves
    try {
      const moves: (string | string[])[] = JSON.parse(row.moves)
      for (const move of moves) {
        const names = Array.isArray(move) ? move : [move]
        for (const name of names) {
          if (name && !moveExists(name)) {
            issues.push({
              table: "SmogonSet",
              formatId: row.formatId,
              pokemonId: row.pokemonId,
              field: "moves",
              value: name,
              message: `Move "${name}" not found in @pkmn/dex`,
            })
          }
        }
      }
    } catch {
      issues.push({
        table: "SmogonSet",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "moves",
        value: row.moves,
        message: `Malformed moves JSON`,
      })
    }
  }
  return { issues, total: rows.length }
}

function verifyPokemonIdPairs(
  table: string,
  rows: { formatId: string; idA: string; idB: string; fieldA: string; fieldB: string }[],
): Issue[] {
  const issues: Issue[] = []
  const checked = new Map<string, boolean>()
  for (const row of rows) {
    for (const { id, field } of [
      { id: row.idA, field: row.fieldA },
      { id: row.idB, field: row.fieldB },
    ]) {
      if (!checked.has(id)) {
        checked.set(id, speciesExists(id))
      }
      if (!checked.get(id)) {
        issues.push({
          table,
          formatId: row.formatId,
          pokemonId: id,
          field,
          value: id,
          message: `Species "${id}" not found in @pkmn/dex`,
        })
      }
    }
  }
  return issues
}

async function verifyTeammateCorr(
  formatFilter?: string,
): Promise<{ issues: Issue[]; total: number }> {
  const where = formatFilter ? { formatId: formatFilter } : {}
  const rows = await prisma.teammateCorr.findMany({
    where,
    select: { formatId: true, pokemonAId: true, pokemonBId: true },
    distinct: ["formatId", "pokemonAId", "pokemonBId"],
  })

  const mapped = rows.map((r) => ({
    formatId: r.formatId,
    idA: r.pokemonAId,
    idB: r.pokemonBId,
    fieldA: "pokemonAId",
    fieldB: "pokemonBId",
  }))
  return { issues: verifyPokemonIdPairs("TeammateCorr", mapped), total: rows.length }
}

async function verifyCheckCounters(
  formatFilter?: string,
): Promise<{ issues: Issue[]; total: number }> {
  const where = formatFilter ? { formatId: formatFilter } : {}
  const rows = await prisma.checkCounter.findMany({
    where,
    select: { formatId: true, targetId: true, counterId: true },
    distinct: ["formatId", "targetId", "counterId"],
  })

  const mapped = rows.map((r) => ({
    formatId: r.formatId,
    idA: r.targetId,
    idB: r.counterId,
    fieldA: "targetId",
    fieldB: "counterId",
  }))
  return { issues: verifyPokemonIdPairs("CheckCounter", mapped), total: rows.length }
}

async function verifyMoveUsage(formatFilter?: string): Promise<{ issues: Issue[]; total: number }> {
  const where = formatFilter ? { formatId: formatFilter } : {}
  const rows = await prisma.moveUsage.findMany({
    where,
    select: { formatId: true, pokemonId: true, moveName: true },
  })

  const issues: Issue[] = []
  const checkedPokemon = new Map<string, boolean>()
  const checkedMoves = new Map<string, boolean>()

  for (const row of rows) {
    // Check Pokemon
    if (!checkedPokemon.has(row.pokemonId)) {
      checkedPokemon.set(row.pokemonId, speciesExists(row.pokemonId))
    }
    if (!checkedPokemon.get(row.pokemonId)) {
      issues.push({
        table: "MoveUsage",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "pokemonId",
        value: row.pokemonId,
        message: `Species "${row.pokemonId}" not found in @pkmn/dex`,
      })
    }

    // Check Move
    if (!checkedMoves.has(row.moveName)) {
      checkedMoves.set(row.moveName, moveExists(row.moveName))
    }
    if (!checkedMoves.get(row.moveName)) {
      issues.push({
        table: "MoveUsage",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "moveName",
        value: row.moveName,
        message: `Move "${row.moveName}" not found in @pkmn/dex`,
      })
    }
  }
  return { issues, total: rows.length }
}

async function verifyItemUsage(formatFilter?: string): Promise<{ issues: Issue[]; total: number }> {
  const where = formatFilter ? { formatId: formatFilter } : {}
  const rows = await prisma.itemUsage.findMany({
    where,
    select: { formatId: true, pokemonId: true, itemName: true },
  })

  const issues: Issue[] = []
  const checkedItems = new Map<string, boolean>()

  for (const row of rows) {
    if (!checkedItems.has(row.itemName)) {
      checkedItems.set(row.itemName, itemExists(row.itemName))
    }
    if (!checkedItems.get(row.itemName)) {
      issues.push({
        table: "ItemUsage",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "itemName",
        value: row.itemName,
        message: `Item "${row.itemName}" not found in @pkmn/dex`,
      })
    }
  }
  return { issues, total: rows.length }
}

async function verifyAbilityUsage(
  formatFilter?: string,
): Promise<{ issues: Issue[]; total: number }> {
  const where = formatFilter ? { formatId: formatFilter } : {}
  const rows = await prisma.abilityUsage.findMany({
    where,
    select: { formatId: true, pokemonId: true, abilityName: true },
  })

  const issues: Issue[] = []
  const checkedAbilities = new Map<string, boolean>()

  for (const row of rows) {
    if (!checkedAbilities.has(row.abilityName)) {
      checkedAbilities.set(row.abilityName, abilityExists(row.abilityName))
    }
    if (!checkedAbilities.get(row.abilityName)) {
      issues.push({
        table: "AbilityUsage",
        formatId: row.formatId,
        pokemonId: row.pokemonId,
        field: "abilityName",
        value: row.abilityName,
        message: `Ability "${row.abilityName}" not found in @pkmn/dex`,
      })
    }
  }
  return { issues, total: rows.length }
}

// ─── Fix: delete rows with unresolvable Pokemon IDs ─────────────────────────

const POKEMON_ID_FIELDS = new Set([
  "pokemonId",
  "pokemonAId",
  "pokemonBId",
  "targetId",
  "counterId",
])

function buildDeleteQuery(table: string, idList: string[]): Promise<{ count: number }> | undefined {
  const byPokemonId = { where: { pokemonId: { in: idList } } }
  const queries: Record<string, Promise<{ count: number }>> = {
    UsageStats: prisma.usageStats.deleteMany(byPokemonId),
    SmogonSet: prisma.smogonSet.deleteMany(byPokemonId),
    TeammateCorr: prisma.teammateCorr.deleteMany({
      where: { OR: [{ pokemonAId: { in: idList } }, { pokemonBId: { in: idList } }] },
    }),
    CheckCounter: prisma.checkCounter.deleteMany({
      where: { OR: [{ targetId: { in: idList } }, { counterId: { in: idList } }] },
    }),
    MoveUsage: prisma.moveUsage.deleteMany(byPokemonId),
    ItemUsage: prisma.itemUsage.deleteMany(byPokemonId),
    AbilityUsage: prisma.abilityUsage.deleteMany(byPokemonId),
  }
  return queries[table]
}

async function fixBadPokemonIds(issues: Issue[]): Promise<void> {
  const badIds = new Map<string, Set<string>>()
  for (const issue of issues) {
    if (POKEMON_ID_FIELDS.has(issue.field)) {
      if (!badIds.has(issue.table)) badIds.set(issue.table, new Set())
      badIds.get(issue.table)!.add(issue.value)
    }
  }

  if (badIds.size === 0) {
    console.log("\n[fix] No bad Pokemon IDs to clean up.")
    return
  }

  console.log("\n[fix] Cleaning up rows with unresolvable Pokemon IDs...\n")

  for (const [table, ids] of badIds) {
    const idList = [...ids]
    const query = buildDeleteQuery(table, idList)
    if (!query) continue
    const { count } = await query
    console.log(`  [fix] ${table}: deleted ${count} rows (bad IDs: ${idList.join(", ")})`)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs()

  console.log("=== Seed Data Verification ===\n")
  if (args.formatId) console.log(`Format filter: ${args.formatId}`)
  if (args.fix) console.log("Fix mode: will delete rows with bad Pokemon IDs\n")

  const allIssues: Issue[] = []

  // Run all checks
  const checks = [
    { name: "UsageStats", fn: () => verifyUsageStats(args.formatId) },
    { name: "SmogonSet", fn: () => verifySmogonSets(args.formatId) },
    { name: "TeammateCorr", fn: () => verifyTeammateCorr(args.formatId) },
    { name: "CheckCounter", fn: () => verifyCheckCounters(args.formatId) },
    { name: "MoveUsage", fn: () => verifyMoveUsage(args.formatId) },
    { name: "ItemUsage", fn: () => verifyItemUsage(args.formatId) },
    { name: "AbilityUsage", fn: () => verifyAbilityUsage(args.formatId) },
  ]

  for (const check of checks) {
    process.stdout.write(`Checking ${check.name}...`)
    const { issues, total } = await check.fn()
    allIssues.push(...issues)

    if (issues.length === 0) {
      console.log(` OK (${total} rows)`)
    } else {
      console.log(` ${issues.length} issues (${total} rows)`)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log("\n=== Summary ===\n")

  if (allIssues.length === 0) {
    console.log("All seeded data is valid.")
    await prisma.$disconnect()
    return
  }

  // Group issues by type for a clear report
  const byTable = new Map<string, Issue[]>()
  for (const issue of allIssues) {
    if (!byTable.has(issue.table)) byTable.set(issue.table, [])
    byTable.get(issue.table)!.push(issue)
  }

  // Deduplicate bad Pokemon IDs for top-level summary
  const badPokemonIds = new Set<string>()
  const badMoves = new Set<string>()
  const badItems = new Set<string>()
  const badAbilities = new Set<string>()

  for (const issue of allIssues) {
    if (POKEMON_ID_FIELDS.has(issue.field)) {
      badPokemonIds.add(issue.value)
    } else if (issue.field === "moves" || issue.field === "moveName") {
      badMoves.add(issue.value)
    } else if (issue.field === "itemName") {
      badItems.add(issue.value)
    } else if (issue.field === "abilityName" || issue.field === "ability") {
      badAbilities.add(issue.value)
    }
  }

  console.log(`Total issues: ${allIssues.length}`)
  if (badPokemonIds.size > 0)
    console.log(
      `  Bad Pokemon IDs (${badPokemonIds.size}): ${[...badPokemonIds].sort().join(", ")}`,
    )
  if (badMoves.size > 0)
    console.log(`  Bad moves (${badMoves.size}): ${[...badMoves].sort().join(", ")}`)
  if (badItems.size > 0)
    console.log(`  Bad items (${badItems.size}): ${[...badItems].sort().join(", ")}`)
  if (badAbilities.size > 0)
    console.log(`  Bad abilities (${badAbilities.size}): ${[...badAbilities].sort().join(", ")}`)

  // Detailed breakdown by table — dedupe by (field, value) and show affected formats + count
  console.log("\n--- Details by table ---\n")
  for (const [table, issues] of byTable) {
    console.log(`${table} (${issues.length} issues):`)

    // Group by field+value, collect formats and count
    const grouped = new Map<string, { message: string; formats: Set<string>; count: number }>()
    for (const issue of issues) {
      const key = `${issue.field}|${issue.value}`
      if (!grouped.has(key)) {
        grouped.set(key, { message: issue.message, formats: new Set(), count: 0 })
      }
      const entry = grouped.get(key)!
      entry.formats.add(issue.formatId)
      entry.count++
    }

    for (const [, { message, formats, count }] of grouped) {
      const fmts = [...formats].sort().join(", ")
      console.log(`  ${message} (${count} rows across: ${fmts})`)
    }
    console.log()
  }

  // Fix mode
  if (args.fix) {
    await fixBadPokemonIds(allIssues)
  } else if (badPokemonIds.size > 0) {
    console.log("Run with --fix to delete rows with bad Pokemon IDs.")
  }

  await prisma.$disconnect()
  process.exit(1)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
