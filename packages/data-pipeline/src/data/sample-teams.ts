import data from "./sample-teams.json" with { type: "json" }

interface SampleTeamSeedEntry {
  name: string
  formatId: string
  archetype: string
  paste: string
  source: string
}

export const SAMPLE_TEAMS: SampleTeamSeedEntry[] = data
