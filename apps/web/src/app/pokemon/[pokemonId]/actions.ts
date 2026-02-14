"use server"

import type { UsageStatsEntry } from "@nasty-plot/core"
import { getActiveFormats } from "@nasty-plot/formats"
import { getUsageForPokemon } from "@nasty-plot/smogon-data"

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
      const stats = await getUsageForPokemon(f.id, pokemonId).catch(() => null)
      return { formatId: f.id, formatName: f.name, stats }
    }),
  )
}
