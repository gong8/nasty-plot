import { buildTeamContext, buildMetaContext } from "./context-builder";
import type { TeamData, TeamSlotData, UsageStatsEntry, PokemonSpecies, StatsTable } from "@/shared/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpecies(overrides?: Partial<PokemonSpecies>): PokemonSpecies {
  return {
    id: "garchomp",
    name: "Garchomp",
    num: 445,
    types: ["Dragon", "Ground"],
    baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
    abilities: { "0": "Sand Veil", "H": "Rough Skin" },
    weightkg: 95,
    ...overrides,
  };
}

function makeSlot(overrides?: Partial<TeamSlotData>): TeamSlotData {
  return {
    position: 1,
    pokemonId: "garchomp",
    species: makeSpecies(),
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: "Steel",
    level: 100,
    moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Stealth Rock"],
    evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    ...overrides,
  };
}

function makeTeam(overrides?: Partial<TeamData>): TeamData {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    slots: [makeSlot()],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildTeamContext
// ---------------------------------------------------------------------------

describe("buildTeamContext", () => {
  it("produces the team header with name, format, and slot count", () => {
    const team = makeTeam({ name: "My OU Squad" });
    const ctx = buildTeamContext(team);

    expect(ctx).toContain('## Current Team: "My OU Squad"');
    expect(ctx).toContain("Format: gen9ou");
    expect(ctx).toContain("Slots filled: 1/6");
  });

  it("includes species information for each slot", () => {
    const team = makeTeam();
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("### Slot 1: Garchomp");
    expect(ctx).toContain("- Type: Dragon/Ground");
    expect(ctx).toContain("- Ability: Rough Skin");
    expect(ctx).toContain("- Item: Leftovers");
    expect(ctx).toContain("- Nature: Jolly");
    expect(ctx).toContain("- Tera Type: Steel");
    expect(ctx).toContain("- Moves: Earthquake, Dragon Claw, Swords Dance, Stealth Rock");
  });

  it("formats EVs as readable string", () => {
    const team = makeTeam();
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("252 ATK");
    expect(ctx).toContain("4 SPD");
    expect(ctx).toContain("252 SPE");
    // 0 EVs should not appear
    expect(ctx).not.toContain("0 HP");
  });

  it("shows 'None' for no EVs when all are zero", () => {
    const team = makeTeam({
      slots: [
        makeSlot({
          evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        }),
      ],
    });
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("- EVs: None");
  });

  it("shows 'None' for no moves", () => {
    const team = makeTeam({
      slots: [makeSlot({ moves: [""] })],
    });
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("- Moves: None");
  });

  it("includes base stats with BST", () => {
    const team = makeTeam();
    const ctx = buildTeamContext(team);

    // Garchomp BST: 108 + 130 + 95 + 80 + 85 + 102 = 600
    expect(ctx).toContain("- Base Stats: 108/130/95/80/85/102 (BST: 600)");
  });

  it("omits Tera Type line when not set", () => {
    const team = makeTeam({
      slots: [makeSlot({ teraType: undefined })],
    });
    const ctx = buildTeamContext(team);

    expect(ctx).not.toContain("- Tera Type:");
  });

  it("handles slot without species (uses pokemonId as fallback)", () => {
    const team = makeTeam({
      slots: [makeSlot({ species: undefined, pokemonId: "greattusk" })],
    });
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("### Slot 1: greattusk");
    expect(ctx).toContain("- Type: Unknown");
    // No base stats section since species is undefined
    expect(ctx).not.toContain("- Base Stats:");
  });

  it("handles multiple slots", () => {
    const team = makeTeam({
      slots: [
        makeSlot({ position: 1, pokemonId: "garchomp" }),
        makeSlot({
          position: 2,
          pokemonId: "heatran",
          species: makeSpecies({
            id: "heatran",
            name: "Heatran",
            num: 485,
            types: ["Fire", "Steel"],
            baseStats: { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 },
          }),
          ability: "Flash Fire",
          item: "Air Balloon",
          nature: "Calm",
          teraType: "Grass",
          moves: ["Magma Storm", "Earth Power", "Stealth Rock", "Toxic"],
          evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
        }),
      ],
    });
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("Slots filled: 2/6");
    expect(ctx).toContain("### Slot 1: Garchomp");
    expect(ctx).toContain("### Slot 2: Heatran");
    expect(ctx).toContain("- Type: Fire/Steel");
  });

  it("includes team type composition section", () => {
    const team = makeTeam({
      slots: [
        makeSlot({ position: 1, pokemonId: "garchomp" }),
        makeSlot({
          position: 2,
          pokemonId: "heatran",
          species: makeSpecies({
            id: "heatran",
            name: "Heatran",
            types: ["Fire", "Steel"],
            baseStats: { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 },
          }),
        }),
      ],
    });
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("### Team Type Composition");
    expect(ctx).toContain("Types represented:");
    expect(ctx).toContain("Dragon");
    expect(ctx).toContain("Ground");
    expect(ctx).toContain("Fire");
    expect(ctx).toContain("Steel");
  });

  it("deduplicates types in type composition", () => {
    const team = makeTeam({
      slots: [
        makeSlot({
          position: 1,
          species: makeSpecies({ types: ["Dragon", "Ground"] }),
        }),
        makeSlot({
          position: 2,
          species: makeSpecies({ types: ["Dragon", "Flying"] }),
        }),
      ],
    });
    const ctx = buildTeamContext(team);

    // Count occurrences of "Dragon" in the Types represented line
    const typeLine = ctx.split("\n").find((l) => l.includes("Types represented:"));
    expect(typeLine).toBeTruthy();
    const dragonCount = (typeLine!.match(/Dragon/g) || []).length;
    expect(dragonCount).toBe(1); // deduplicated
  });

  it("omits type composition when no slots", () => {
    const team = makeTeam({ slots: [] });
    const ctx = buildTeamContext(team);

    expect(ctx).not.toContain("### Team Type Composition");
    expect(ctx).toContain("Slots filled: 0/6");
  });

  it("filters out empty move strings", () => {
    const team = makeTeam({
      slots: [makeSlot({ moves: ["Earthquake", "", "Dragon Claw"] })],
    });
    const ctx = buildTeamContext(team);

    expect(ctx).toContain("- Moves: Earthquake, Dragon Claw");
  });
});

// ---------------------------------------------------------------------------
// buildMetaContext
// ---------------------------------------------------------------------------

describe("buildMetaContext", () => {
  it("produces a meta overview header", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", usagePercent: 35.55, rank: 1 },
    ];

    const ctx = buildMetaContext("gen9ou", topPokemon);

    expect(ctx).toContain("## Meta Overview: gen9ou");
    expect(ctx).toContain("Top 1 Pokemon by usage:");
  });

  it("lists Pokemon with rank, name, and usage percent", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", pokemonName: "Garchomp", usagePercent: 35.55, rank: 1 },
      { pokemonId: "heatran", pokemonName: "Heatran", usagePercent: 20.30, rank: 2 },
    ];

    const ctx = buildMetaContext("gen9ou", topPokemon);

    expect(ctx).toContain("1. Garchomp - 35.55% usage");
    expect(ctx).toContain("2. Heatran - 20.30% usage");
  });

  it("uses pokemonId as fallback when pokemonName is not set", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "garchomp", usagePercent: 35.55, rank: 1 },
    ];

    const ctx = buildMetaContext("gen9ou", topPokemon);

    expect(ctx).toContain("1. garchomp - 35.55% usage");
  });

  it("formats usage percent to 2 decimal places", () => {
    const topPokemon: UsageStatsEntry[] = [
      { pokemonId: "pikachu", usagePercent: 1.5, rank: 50 },
    ];

    const ctx = buildMetaContext("gen9ou", topPokemon);

    expect(ctx).toContain("1.50% usage");
  });

  it("handles empty top Pokemon list", () => {
    const ctx = buildMetaContext("gen9ou", []);

    expect(ctx).toContain("## Meta Overview: gen9ou");
    expect(ctx).toContain("Top 0 Pokemon by usage:");
  });

  it("handles large number of Pokemon", () => {
    const topPokemon: UsageStatsEntry[] = Array.from({ length: 30 }, (_, i) => ({
      pokemonId: `pokemon${i + 1}`,
      pokemonName: `Pokemon ${i + 1}`,
      usagePercent: 50 - i,
      rank: i + 1,
    }));

    const ctx = buildMetaContext("gen9ou", topPokemon);

    expect(ctx).toContain("Top 30 Pokemon by usage:");
    expect(ctx).toContain("1. Pokemon 1 - 50.00% usage");
    expect(ctx).toContain("30. Pokemon 30 - 21.00% usage");
  });
});
