"use server"

import { prisma } from "@nasty-plot/db"
import type { UsageStatsEntry } from "@nasty-plot/core"
import { getActiveFormats } from "@nasty-plot/formats"

interface FormatRow {
  id: string
  name: string
}

export interface FormatUsage {
  formatId: string
  formatName: string
  stats: UsageStatsEntry | null
}

export async function getActiveFormatsFromDb(): Promise<FormatRow[]> {
  return getActiveFormats().map(({ id, name }) => ({ id, name }))
}

export async function getUsageByFormat(
  formats: FormatRow[],
  pokemonId: string,
): Promise<FormatUsage[]> {
  return Promise.all(
    formats.map(async (f) => {
      const row = await prisma.usageStats
        .findFirst({ where: { formatId: f.id, pokemonId }, orderBy: { year: "desc" } })
        .catch(() => null)
      const stats: UsageStatsEntry | null = row
        ? { pokemonId: row.pokemonId, usagePercent: row.usagePercent, rank: row.rank }
        : null
      return { formatId: f.id, formatName: f.name, stats }
    }),
  )
}
