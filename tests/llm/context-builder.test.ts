import type { TeamData, UsageStatsEntry, StatsTable, PokemonType, PokemonSpecies } from "@nasty-plot/core";
import {
  buildTeamContext,
  buildMetaContext,
  buildPokemonContext,
  buildPageContextPrompt,
  buildPlanModePrompt,
} from "@nasty-plot/llm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
const defaultEvs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const defaultIvs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

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
  };
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
    level: 100,
    moves: ["tackle", "earthquake", undefined, undefined] as [string, string | undefined, string | undefined, string | undefined],
    evs: { ...defaultEvs, hp: 252, atk: 252 },
    ivs: defaultIvs,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildTeamContext", () => {
  it("includes team name and format", () => {
    const team = makeTeam({ name: "My OU Team", formatId: "gen9ou" });
    const result = buildTeamContext(team);

    expect(result).toContain("My OU Team");
    expect(result).toContain("gen9ou");
  });

  it("includes slot count", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    });
    const result = buildTeamContext(team);

    expect(result).toContain("1/6");
  });

  it("includes Pokemon details for each slot", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    });
    const result = buildTeamContext(team);

    expect(result).toContain("Garchomp");
    expect(result).toContain("Dragon/Ground");
    expect(result).toContain("Ability");
    expect(result).toContain("Leftovers");
    expect(result).toContain("Adamant");
  });

  it("includes move list", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    });
    const result = buildTeamContext(team);

    expect(result).toContain("tackle");
    expect(result).toContain("earthquake");
  });

  it("includes EV spread", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    });
    const result = buildTeamContext(team);

    expect(result).toContain("252 HP");
    expect(result).toContain("252 ATK");
  });

  it("includes base stats and BST", () => {
    const team = makeTeam({
      slots: [makeSlot("garchomp", ["Dragon", "Ground"])],
    });
    const result = buildTeamContext(team);

    expect(result).toContain("80/80/80/80/80/80");
    expect(result).toContain("BST: 480");
  });

  it("includes type composition summary", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", ["Dragon", "Ground"]),
        makeSlot("heatran", ["Fire", "Steel"]),
      ],
    });
    const result = buildTeamContext(team);

    expect(result).toContain("Team Type Composition");
    expect(result).toContain("Dragon");
    expect(result).toContain("Ground");
    expect(result).toContain("Fire");
    expect(result).toContain("Steel");
  });

  it("handles empty team", () => {
    const team = makeTeam({ slots: [] });
    const result = buildTeamContext(team);

    expect(result).toContain("0/6");
    expect(result).not.toContain("Team Type Composition");
  });

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
          level: 100,
          moves: [undefined, undefined, undefined, undefined] as [string | undefined, string | undefined, string | undefined, string | undefined],
          evs: defaultEvs,
          ivs: defaultIvs,
        },
      ],
    });
    const result = buildTeamContext(team);

    expect(result).toContain("unknown");
    expect(result).toContain("Unknown");
  });

  it("includes tera type when present", () => {
    const slot = makeSlot("garchomp", ["Dragon", "Ground"]);
    const slotWithTera = { ...slot, teraType: "Fairy" as PokemonType };
    const team = makeTeam({ slots: [slotWithTera] });
    const result = buildTeamContext(team);

    expect(result).toContain("Tera Type: Fairy");
  });
});

describe("buildMetaContext", () => {
  it("includes format id and top pokemon count", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", usagePercent: 25.5, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20.3, rank: 2 },
    ];

    const result = buildMetaContext("gen9ou", topPokemon);

    expect(result).toContain("gen9ou");
    expect(result).toContain("Top 2 Pokemon");
  });

  it("includes Pokemon names and usage percentages", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", pokemonName: "Garchomp", usagePercent: 25.5, rank: 1 },
    ];

    const result = buildMetaContext("gen9ou", topPokemon);

    expect(result).toContain("Garchomp");
    expect(result).toContain("25.50%");
  });

  it("falls back to pokemonId when pokemonName is missing", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", usagePercent: 25.5, rank: 1 },
    ];

    const result = buildMetaContext("gen9ou", topPokemon);

    expect(result).toContain("garchomp");
  });

  it("includes rank numbers", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", usagePercent: 25.5, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20.3, rank: 2 },
    ];

    const result = buildMetaContext("gen9ou", topPokemon);

    expect(result).toContain("1.");
    expect(result).toContain("2.");
  });

  it("handles empty pokemon list", () => {
    const result = buildMetaContext("gen9ou", []);

    expect(result).toContain("gen9ou");
    expect(result).toContain("Top 0 Pokemon");
  });
});

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
    };
  }

  it("includes species name", () => {
    const result = buildPokemonContext("garchomp", makeSpecies());
    expect(result).toContain("Currently Viewing: Garchomp");
  });

  it("includes types", () => {
    const result = buildPokemonContext("garchomp", makeSpecies());
    expect(result).toContain("Types: Dragon/Ground");
  });

  it("includes base stats and BST", () => {
    const result = buildPokemonContext("garchomp", makeSpecies());
    expect(result).toContain("108/130/95/80/85/102");
    expect(result).toContain("BST: 600");
  });

  it("includes abilities with Hidden marker", () => {
    const result = buildPokemonContext("garchomp", makeSpecies());
    expect(result).toContain("Sand Veil");
    expect(result).toContain("Rough Skin (Hidden)");
  });

  it("includes tier when present", () => {
    const result = buildPokemonContext(
      "garchomp",
      makeSpecies({ tier: "OU" } as Partial<PokemonSpecies>)
    );
    expect(result).toContain("Tier: OU");
  });

  it("omits tier line when tier is empty/absent", () => {
    const result = buildPokemonContext("garchomp", makeSpecies({ tier: undefined } as Partial<PokemonSpecies>));
    expect(result).not.toContain("Tier:");
  });

  it("handles single type", () => {
    const result = buildPokemonContext(
      "pikachu",
      makeSpecies({ types: ["Electric"] })
    );
    expect(result).toContain("Types: Electric");
  });
});

describe("buildPageContextPrompt", () => {
  it("returns context with summary", () => {
    const result = buildPageContextPrompt({
      pageType: "team-editor",
      contextSummary: "Editing team with 3 Pokemon",
    });
    expect(result).toContain("Current Page Context");
    expect(result).toContain("Editing team with 3 Pokemon");
  });

  it("returns empty string when contextSummary is empty", () => {
    const result = buildPageContextPrompt({
      pageType: "other",
      contextSummary: "",
    });
    expect(result).toBe("");
  });
});

describe("buildPlanModePrompt", () => {
  it("returns planning instructions", () => {
    const result = buildPlanModePrompt();
    expect(result).toContain("Planning");
    expect(result).toContain("<plan>");
    expect(result).toContain("<step>");
    expect(result).toContain("step_update");
  });
});
