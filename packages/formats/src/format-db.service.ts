import { prisma } from "@nasty-plot/db"
import type { GameType } from "@nasty-plot/core"

import { FORMAT_DEFINITIONS } from "./data/format-definitions"

function parseGeneration(formatId: string): number {
  const firstDigit = formatId.match(/\d/)?.[0]
  return firstDigit ? parseInt(firstDigit) : 9
}

function inferGameType(formatId: string): GameType {
  return formatId.includes("doubles") || formatId.includes("vgc") ? "doubles" : "singles"
}

export async function ensureFormatExists(
  formatId: string,
  generation?: number,
  gameType?: GameType,
) {
  const def = FORMAT_DEFINITIONS.find((f) => f.id === formatId)
  const name = def?.name ?? formatId
  const gen = generation ?? def?.generation ?? parseGeneration(formatId)
  const type = gameType ?? def?.gameType ?? inferGameType(formatId)

  return prisma.format.upsert({
    where: { id: formatId },
    update: {},
    create: {
      id: formatId,
      name,
      generation: gen,
      gameType: type,
      isActive: true,
    },
  })
}
