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

  const labels = [
    "BattleTurn",
    "Battle",
    "BatchSimulation",
    "ChatMessage",
    "ChatSession",
    "TeamSlot",
    "Team",
  ]

  for (let i = 0; i < labels.length; i++) {
    const count = results[i].count
    if (count > 0) {
      console.log(`  Deleted ${count} ${labels[i]} rows`)
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
