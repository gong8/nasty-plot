import { prisma } from "@nasty-plot/db"
import { parseShowdownPaste } from "@nasty-plot/core"

export interface SampleTeamData {
  id: string
  name: string
  formatId: string
  archetype: string | null
  source: string | null
  sourceUrl: string | null
  paste: string
  pokemonIds: string
  isActive: boolean
  createdAt: Date
}

/** Client-friendly view of a sample team with pokemonIds as an array instead of CSV string. */
export interface SampleTeamView {
  id: string
  name: string
  formatId: string
  archetype: string | null
  source: string | null
  sourceUrl: string | null
  paste: string
  pokemonIds: string[]
  isActive: boolean
  createdAt: Date
}

/** Convert a DB-shaped SampleTeamData (CSV pokemonIds) to a SampleTeamView (array pokemonIds). */
export function toSampleTeamView(data: SampleTeamData): SampleTeamView {
  return {
    ...data,
    pokemonIds: data.pokemonIds ? data.pokemonIds.split(",").filter(Boolean) : [],
  }
}

export function extractPokemonIds(paste: string): string[] {
  const parsed = parseShowdownPaste(paste)
  return parsed.map((p) => p.pokemonId).filter(Boolean) as string[]
}

export async function createSampleTeam(input: {
  name: string
  formatId: string
  paste: string
  archetype?: string
  source?: string
  sourceUrl?: string
}): Promise<SampleTeamData> {
  const pokemonIds = extractPokemonIds(input.paste).join(",")
  return prisma.sampleTeam.create({
    data: {
      name: input.name,
      formatId: input.formatId,
      paste: input.paste,
      archetype: input.archetype || null,
      source: input.source || null,
      sourceUrl: input.sourceUrl || null,
      pokemonIds,
    },
  })
}

export async function listSampleTeams(filters?: {
  formatId?: string
  archetype?: string
  search?: string
}): Promise<SampleTeamData[]> {
  const where: Record<string, unknown> = { isActive: true }
  if (filters?.formatId) where.formatId = filters.formatId
  if (filters?.archetype) where.archetype = filters.archetype
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { pokemonIds: { contains: filters.search } },
    ]
  }
  return prisma.sampleTeam.findMany({ where, orderBy: { createdAt: "desc" } })
}

export async function getSampleTeam(id: string): Promise<SampleTeamData | null> {
  return prisma.sampleTeam.findUnique({ where: { id } })
}

export async function deleteSampleTeam(id: string): Promise<void> {
  await prisma.sampleTeam.delete({ where: { id } })
}

export async function importSampleTeamsFromPastes(
  pastes: { name: string; paste: string; archetype?: string }[],
  formatId: string,
  source?: string,
): Promise<SampleTeamData[]> {
  const results: SampleTeamData[] = []
  for (const entry of pastes) {
    const team = await createSampleTeam({
      name: entry.name,
      formatId,
      paste: entry.paste,
      archetype: entry.archetype,
      source,
    })
    results.push(team)
  }
  return results
}
