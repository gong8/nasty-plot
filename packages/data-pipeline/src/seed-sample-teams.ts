import { prisma } from "@nasty-plot/db"
import { createSampleTeam, extractPokemonIds } from "@nasty-plot/teams"
import { upsertSyncLog } from "@nasty-plot/smogon-data"
import { SAMPLE_TEAMS } from "./data/sample-teams"

const SOURCE = "curated-seed"

export async function seedSampleTeams(force: boolean): Promise<{
  seeded: number
  skipped: boolean
}> {
  const existing = await prisma.sampleTeam.count({
    where: { source: SOURCE },
  })

  if (existing > 0 && !force) {
    console.log(`[seed] Sample teams already seeded (${existing} teams), skipping.`)
    return { seeded: 0, skipped: true }
  }

  // Delete existing curated-seed teams (preserves any user-created teams)
  if (existing > 0) {
    const deleted = await prisma.sampleTeam.deleteMany({
      where: { source: SOURCE },
    })
    console.log(`[seed] Deleted ${deleted.count} existing curated-seed sample teams`)
  }

  console.log(`[seed] Seeding ${SAMPLE_TEAMS.length} sample teams...`)

  let seeded = 0
  for (const team of SAMPLE_TEAMS) {
    try {
      const pokemonIds = extractPokemonIds(team.paste)

      await createSampleTeam({
        name: team.name,
        formatId: team.formatId,
        archetype: team.archetype,
        source: team.source,
        paste: team.paste,
      })
      seeded++
      console.log(`  [OK] ${team.name} (${team.formatId}) — ${pokemonIds.join(",")}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [FAIL] ${team.name}: ${msg}`)
    }
  }

  const syncStatus = seeded === SAMPLE_TEAMS.length ? "ok" : "partial"
  await upsertSyncLog(
    "sample-teams",
    "all",
    `Seeded ${seeded}/${SAMPLE_TEAMS.length} sample teams`,
    syncStatus,
  )

  return { seeded, skipped: false }
}
