import type {
  TeamData,
  UsageStatsEntry,
  StatsTable,
  PokemonType,
  PokemonSpecies,
} from "@nasty-plot/core"
import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL } from "@nasty-plot/core"
import {
  buildTeamContext,
  buildMetaContext,
  buildPokemonContext,
  buildPageContextPrompt,
  buildContextModePrompt,
  buildPlanModePrompt,
} from "@nasty-plot/llm"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }

function makeTeam(overrides?: Partial<TeamData>): TeamData {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    slots: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeSlot(pokemonId: string, types: [PokemonType] | [PokemonType, PokemonType]) {
  return {
    position: 1,
    pokemonId,
    species: {
      id: pokemonId,
      name: pokemonId.charAt(0).toUpperCase() + pokemonId.slice(1),
      num: 1,
      types,
      baseStats: defaultStats,
      abilities: { "0": "Ability" },
      weightkg: 50,
    },
    ability: "Ability",
    item: "Leftovers",
    nature: "Adamant" as const,
    level: DEFAULT_LEVEL,
    moves: ["tackle", "earthquake", undefined, undefined] as [
      string,
      string | undefined,
      string | undefined,
      string | undefined,
    ],
    evs: { ...DEFAULT_EVS, hp: 252, atk: 252 },
    ivs: DEFAULT_IVS,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildTeamContext", () => {
  it("includes team name and format", () => {
    const team = makeTeam({ name: "My OU Team", formatId: "gen9ou" })
    const result = buildTeamContext(team)

    expect(result).toContain("My OU Team")
    expect(result).toContain("gen9ou")
  })

  it("includes slot count", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    })
    const result = buildTeamContext(team)

    expect(result).toContain("1/6")
  })

  it("includes Pokemon details for each slot", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    })
    const result = buildTeamContext(team)

    expect(result).toContain("Garchomp")
    expect(result).toContain("Dragon/Ground")
    expect(result).toContain("Ability")
    expect(result).toContain("Leftovers")
    expect(result).toContain("Adamant")
  })

  it("includes move list", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    })
    const result = buildTeamContext(team)

    expect(result).toContain("tackle")
    expect(result).toContain("earthquake")
  })

  it("includes EV spread", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    })
    const result = buildTeamContext(team)

    expect(result).toContain("252 HP")
    expect(result).toContain("252 ATK")
  })

  it("includes base stats and BST", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    })
    const result = buildTeamContext(team)

    expect(result).toContain("80/80/80/80/80/80")
    expect(result).toContain("BST: 480")
  })

  it("includes type composition summary", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"]), makeSlot("heatran", ["Fire", "Steel"])],
    })
    const result = buildTeamContext(team)

    expect(result).toContain("Team Type Composition")
    expect(result).toContain("Dragon")
    expect(result).toContain("Ground")
    expect(result).toContain("Fire")
    expect(result).toContain("Steel")
  })

  it("handles empty team", () => {
    const team = makeTeam({ slots: [] })
    const result = buildTeamContext(team)

    expect(result).toContain("0/6")
    expect(result).not.toContain("Team Type Composition")
  })

  it("handles slot without species data", () => {
    const team = makeTeam({
      slots: [
        {
          position: 1,
          pokemonId: "unknown",
          species: undefined,
          ability: "",
          item: "",
          nature: "Hardy" as const,
          level: DEFAULT_LEVEL,
          moves: [undefined, undefined, undefined, undefined] as [
            string | undefined,
            string | undefined,
            string | undefined,
            string | undefined,
          ],
          evs: DEFAULT_EVS,
          ivs: DEFAULT_IVS,
        },
      ],
    })
    const result = buildTeamContext(team)

    expect(result).toContain("unknown")
    expect(result).toContain("Unknown")
  })

  it("includes tera type when present", () => {
    const slot = makeSlot("garchomp", ["Dragon", "Ground"])
    const slotWithTera = { ...slot, teraType: "Fairy" as PokemonType }
    const team = makeTeam({ slots: [slotWithTera] })
    const result = buildTeamContext(team)

    expect(result).toContain("Tera Type: Fairy")
  })
})

describe("buildMetaContext", () => {
  it("includes format id and top pokemon count", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", usagePercent: 25.5, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20.3, rank: 2 },
    ]

    const result = buildMetaContext("gen9ou", topPokemon)

    expect(result).toContain("gen9ou")
    expect(result).toContain("Top 2 Pokemon")
  })

  it("includes Pokemon names and usage percentages", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", pokemonName: "Garchomp", usagePercent: 25.5, rank: 1 },
    ]

    const result = buildMetaContext("gen9ou", topPokemon)

    expect(result).toContain("Garchomp")
    expect(result).toContain("25.50%")
  })

  it("falls back to pokemonId when pokemonName is missing", () => {
    const topPokemon: UsageStatsEntry[] = [{ pokemonId: "garchomp", usagePercent: 25.5, rank: 1 }]

    const result = buildMetaContext("gen9ou", topPokemon)

    expect(result).toContain("garchomp")
  })

  it("includes rank numbers", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", usagePercent: 25.5, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20.3, rank: 2 },
    ]

    const result = buildMetaContext("gen9ou", topPokemon)

    expect(result).toContain("1.")
    expect(result).toContain("2.")
  })

  it("handles empty pokemon list", () => {
    const result = buildMetaContext("gen9ou", [])

    expect(result).toContain("gen9ou")
    expect(result).toContain("Top 0 Pokemon")
  })
})

describe("buildPokemonContext", () => {
  function makeSpecies(overrides?: Partial<PokemonSpecies>): PokemonSpecies {
    return {
      id: "garchomp",
      name: "Garchomp",
      num: 445,
      types: ["Dragon", "Ground"],
      baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
      abilities: { "0": "Sand Veil", H: "Rough Skin" },
      weightkg: 95,
      ...overrides,
    }
  }

  it("includes species name", () => {
    const result = buildPokemonContext("garchomp", makeSpecies())
    expect(result).toContain("Currently Viewing: Garchomp")
  })

  it("includes types", () => {
    const result = buildPokemonContext("garchomp", makeSpecies())
    expect(result).toContain("Types: Dragon/Ground")
  })

  it("includes base stats and BST", () => {
    const result = buildPokemonContext("garchomp", makeSpecies())
    expect(result).toContain("108/130/95/80/85/102")
    expect(result).toContain("BST: 600")
  })

  it("includes abilities with Hidden marker", () => {
    const result = buildPokemonContext("garchomp", makeSpecies())
    expect(result).toContain("Sand Veil")
    expect(result).toContain("Rough Skin (Hidden)")
  })

  it("includes tier when present", () => {
    const result = buildPokemonContext(
      "garchomp",
      makeSpecies({ tier: "OU" } as Partial<PokemonSpecies>),
    )
    expect(result).toContain("Tier: OU")
  })

  it("omits tier line when tier is empty/absent", () => {
    const result = buildPokemonContext(
      "garchomp",
      makeSpecies({ tier: undefined } as Partial<PokemonSpecies>),
    )
    expect(result).not.toContain("Tier:")
  })

  it("handles single type", () => {
    const result = buildPokemonContext("pikachu", makeSpecies({ types: ["Electric"] }))
    expect(result).toContain("Types: Electric")
  })
})

describe("buildPageContextPrompt", () => {
  it("returns context with summary", () => {
    const result = buildPageContextPrompt({
      pageType: "team-editor",
      contextSummary: "Editing team with 3 Pokemon",
    })
    expect(result).toContain("Current Page Context")
    expect(result).toContain("Editing team with 3 Pokemon")
  })

  it("returns empty string when contextSummary is empty", () => {
    const result = buildPageContextPrompt({
      pageType: "other",
      contextSummary: "",
    })
    expect(result).toBe("")
  })

  it("includes guided builder context", () => {
    const result = buildPageContextPrompt({
      pageType: "team-editor",
      contextSummary: "",
      guidedBuilder: {
        step: "build",
        teamSize: 3,
        currentBuildSlot: 4,
        slotSummaries: [
          "Garchomp - Dragon/Ground",
          "Heatran - Fire/Steel",
          "Toxapex - Poison/Water",
        ],
        formatId: "gen9ou",
      },
    })

    expect(result).toContain("Guided Team Builder")
    expect(result).toContain("Step: build")
    expect(result).toContain("Format: gen9ou")
    expect(result).toContain("Team size: 3/6")
    expect(result).toContain("Currently filling slot 4")
    expect(result).toContain("Current team:")
    expect(result).toContain("1. Garchomp - Dragon/Ground")
    expect(result).toContain("2. Heatran - Fire/Steel")
    expect(result).toContain("3. Toxapex - Poison/Water")
    expect(result).toContain("building a team step-by-step")
  })

  it("includes guided builder without build step indicator", () => {
    const result = buildPageContextPrompt({
      pageType: "team-editor",
      contextSummary: "",
      guidedBuilder: {
        step: "format-select",
        teamSize: 0,
        currentBuildSlot: 1,
        slotSummaries: [],
        formatId: "gen9uu",
      },
    })

    expect(result).toContain("Guided Team Builder")
    expect(result).toContain("Step: format-select")
    expect(result).not.toContain("Currently filling slot")
    expect(result).not.toContain("Current team:")
  })

  it("includes both contextSummary and guidedBuilder", () => {
    const result = buildPageContextPrompt({
      pageType: "team-editor",
      contextSummary: "Team editor page",
      guidedBuilder: {
        step: "build",
        teamSize: 1,
        currentBuildSlot: 2,
        slotSummaries: ["Pikachu - Electric"],
        formatId: "gen9ou",
      },
    })

    expect(result).toContain("Current Page Context")
    expect(result).toContain("Team editor page")
    expect(result).toContain("Guided Team Builder")
    expect(result).toContain("Pikachu - Electric")
  })
})

describe("buildContextModePrompt", () => {
  it("returns empty string for unknown context mode", () => {
    const result = buildContextModePrompt("nonexistent-mode")
    expect(result).toBe("")
  })

  it("returns guided-builder prompt", () => {
    const result = buildContextModePrompt("guided-builder")
    expect(result).toContain("team building advisor")
  })

  it("returns team-editor prompt", () => {
    const result = buildContextModePrompt("team-editor")
    expect(result).toContain("team optimization expert")
  })

  it("returns battle-live prompt", () => {
    const result = buildContextModePrompt("battle-live")
    expect(result).toContain("real-time battle coach")
  })

  it("returns battle-replay prompt", () => {
    const result = buildContextModePrompt("battle-replay")
    expect(result).toContain("post-battle analyst")
  })

  it("parses guided-builder contextData with team info", () => {
    const contextData = JSON.stringify({
      teamName: "My OU Team",
      formatId: "gen9ou",
      paste: "Garchomp @ Choice Scarf",
      slotsFilled: 3,
      slots: ["Garchomp", "Heatran", "Toxapex"],
    })
    const result = buildContextModePrompt("guided-builder", contextData)

    expect(result).toContain('Team: "My OU Team"')
    expect(result).toContain("Format: gen9ou")
    expect(result).toContain("Garchomp @ Choice Scarf")
    expect(result).toContain("Slots filled: 3/6")
    expect(result).toContain("Current team:")
    expect(result).toContain("1. Garchomp")
    expect(result).toContain("2. Heatran")
    expect(result).toContain("3. Toxapex")
  })

  it("parses team-editor contextData with team info", () => {
    const contextData = JSON.stringify({
      teamName: "Rain Team",
      formatId: "gen9uu",
    })
    const result = buildContextModePrompt("team-editor", contextData)

    expect(result).toContain('Team: "Rain Team"')
    expect(result).toContain("Format: gen9uu")
  })

  it("parses battle-live contextData", () => {
    const contextData = JSON.stringify({
      formatId: "gen9ou",
      team1Name: "Player Team",
      team2Name: "Opponent Team",
      aiDifficulty: "expert",
    })
    const result = buildContextModePrompt("battle-live", contextData)

    expect(result).toContain("Format: gen9ou")
    expect(result).toContain("Player: Player Team")
    expect(result).toContain("Opponent: Opponent Team")
    expect(result).toContain("AI Difficulty: expert")
  })

  it("parses battle-replay contextData", () => {
    const contextData = JSON.stringify({
      formatId: "gen9ou",
      team1Name: "Team Alpha",
      team2Name: "Team Beta",
      turnCount: 25,
      winnerId: "team1",
    })
    const result = buildContextModePrompt("battle-replay", contextData)

    expect(result).toContain("Format: gen9ou")
    expect(result).toContain("Team Alpha vs Team Beta")
    expect(result).toContain("25 turns")
    expect(result).toContain("Winner: Team Alpha")
  })

  it("parses battle-replay contextData with team2 winner", () => {
    const contextData = JSON.stringify({
      formatId: "gen9ou",
      team1Name: "Team Alpha",
      team2Name: "Team Beta",
      turnCount: 10,
      winnerId: "team2",
    })
    const result = buildContextModePrompt("battle-replay", contextData)

    expect(result).toContain("Winner: Team Beta")
  })

  it("handles invalid JSON contextData gracefully", () => {
    const result = buildContextModePrompt("guided-builder", "not-valid-json")
    // Should still return the mode prompt without data
    expect(result).toContain("team building advisor")
    expect(result).not.toContain("Team:")
  })

  it("handles contextData without optional fields", () => {
    const contextData = JSON.stringify({})
    const result = buildContextModePrompt("guided-builder", contextData)
    expect(result).toContain("team building advisor")
    expect(result).not.toContain("Team:")
    expect(result).not.toContain("Format:")
  })

  it("handles guided-builder contextData with empty slots array", () => {
    const contextData = JSON.stringify({
      teamName: "My Team",
      slots: [],
    })
    const result = buildContextModePrompt("guided-builder", contextData)
    expect(result).toContain('Team: "My Team"')
    expect(result).not.toContain("Current team:")
  })

  it("returns empty string for unknown mode even with contextData", () => {
    const contextData = JSON.stringify({ formatId: "gen9ou" })
    const result = buildContextModePrompt("unknown-mode", contextData)
    expect(result).toBe("")
  })
})

describe("buildPlanModePrompt", () => {
  it("returns planning instructions", () => {
    const result = buildPlanModePrompt()
    expect(result).toContain("Planning")
    expect(result).toContain("<plan>")
    expect(result).toContain("<step>")
    expect(result).toContain("step_update")
  })
})
