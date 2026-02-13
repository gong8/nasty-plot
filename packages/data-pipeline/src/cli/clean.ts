/**
 * Deletes all user-generated data (teams, battles, chat sessions, sample teams)
 * while preserving seeded reference data (formats, usage stats, Smogon sets, etc.)
 */

import { prisma } from "@nasty-plot/db"

async function clean() {
  console.log("Cleaning user data...\n")

  // Delete in dependency order (children before parents)
  const results = await prisma.$transaction([
    prisma.battleTurn.deleteMany(),
    prisma.battle.deleteMany(),
    prisma.batchSimulation.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.chatSession.deleteMany(),
    prisma.teamSlot.deleteMany(),
    prisma.team.deleteMany(),
  ])

  const deletions = [
    { label: "BattleTurn", count: results[0].count },
    { label: "Battle", count: results[1].count },
    { label: "BatchSimulation", count: results[2].count },
    { label: "ChatMessage", count: results[3].count },
    { label: "ChatSession", count: results[4].count },
    { label: "TeamSlot", count: results[5].count },
    { label: "Team", count: results[6].count },
  ]

  for (const { label, count } of deletions) {
    if (count > 0) {
      console.log(`  Deleted ${count} ${label} rows`)
    }
  }

  console.log("\nDone. Seeded data (formats, usage stats, sets, etc.) is untouched.")
}

clean()
  .catch((e) => {
    console.error("Clean failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
