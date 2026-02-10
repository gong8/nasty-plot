import type { TeamData, StatsTable, PokemonType } from "@nasty-plot/core";
import { validateTeam } from "../validation.service";

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

function makeSlot(
  pokemonId: string,
  overrides?: Record<string, unknown>
) {
  return {
    position: 1,
    pokemonId,
    species: {
      id: pokemonId,
      name: pokemonId,
      num: 1,
      types: ["Normal"] as [PokemonType],
      baseStats: defaultStats,
      abilities: { "0": "Ability" },
      weightkg: 50,
    },
    ability: "Ability",
    item: "Leftovers",
    nature: "Hardy" as const,
    level: 100,
    moves: ["tackle", undefined, undefined, undefined] as [string, string | undefined, string | undefined, string | undefined],
    evs: defaultEvs,
    ivs: defaultIvs,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateTeam", () => {
  it("returns valid for empty team", () => {
    const team = makeTeam({ slots: [] });
    const result = validateTeam(team);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid for a correct team", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", { position: 1, item: "Leftovers" }),
        makeSlot("heatran", { position: 2, item: "Choice Specs" }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // --- Species Clause ---

  it("detects duplicate species", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", { position: 1 }),
        makeSlot("garchomp", { position: 2 }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
    const speciesErrors = result.errors.filter((e) =>
      e.message.includes("Duplicate species")
    );
    expect(speciesErrors.length).toBeGreaterThan(0);
  });

  // --- Item Clause ---

  it("detects duplicate items", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", { position: 1, item: "Leftovers" }),
        makeSlot("heatran", { position: 2, item: "Leftovers" }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
    const itemErrors = result.errors.filter((e) =>
      e.message.includes("Duplicate item")
    );
    expect(itemErrors.length).toBeGreaterThan(0);
  });

  it("allows empty items without duplicate error", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", { position: 1, item: "" }),
        makeSlot("heatran", { position: 2, item: "" }),
      ],
    });

    const result = validateTeam(team);

    const itemErrors = result.errors.filter((e) =>
      e.message.includes("Duplicate item")
    );
    expect(itemErrors).toHaveLength(0);
  });

  // --- EV Validation ---

  it("detects EV total exceeding 510", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", {
          position: 1,
          evs: { hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 },
        }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
    const evErrors = result.errors.filter((e) =>
      e.message.includes("EV total")
    );
    expect(evErrors.length).toBeGreaterThan(0);
  });

  it("detects individual EV exceeding 252", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", {
          position: 1,
          evs: { hp: 300, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
    const evErrors = result.errors.filter((e) =>
      e.message.includes("EVs")
    );
    expect(evErrors.length).toBeGreaterThan(0);
  });

  it("detects negative EVs", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", {
          position: 1,
          evs: { hp: -10, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
  });

  // --- Move Validation ---

  it("detects missing first move", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", {
          position: 1,
          moves: [undefined, undefined, undefined, undefined],
        }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
    const moveErrors = result.errors.filter((e) =>
      e.message.includes("at least one move")
    );
    expect(moveErrors.length).toBeGreaterThan(0);
  });

  // --- Pokemon Selection ---

  it("detects missing pokemonId", () => {
    const team = makeTeam({
      slots: [
        makeSlot("", { position: 1 }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
    const pokemonErrors = result.errors.filter((e) =>
      e.message.includes("Must select a Pokemon")
    );
    expect(pokemonErrors.length).toBeGreaterThan(0);
  });

  // --- Multiple Errors ---

  it("reports multiple errors at once", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", {
          position: 1,
          item: "Leftovers",
          evs: { hp: 300, atk: 300, def: 0, spa: 0, spd: 0, spe: 0 },
          moves: [undefined, undefined, undefined, undefined],
        }),
        makeSlot("garchomp", {
          position: 2,
          item: "Leftovers",
        }),
      ],
    });

    const result = validateTeam(team);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  // --- Valid edge cases ---

  it("allows exactly 510 total EVs", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", {
          position: 1,
          evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 },
        }),
      ],
    });

    const result = validateTeam(team);

    const evTotalErrors = result.errors.filter((e) =>
      e.message.includes("EV total")
    );
    expect(evTotalErrors).toHaveLength(0);
  });

  it("allows exactly 252 in a single EV", () => {
    const team = makeTeam({
      slots: [
        makeSlot("garchomp", {
          position: 1,
          evs: { hp: 252, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        }),
      ],
    });

    const result = validateTeam(team);

    const singleEvErrors = result.errors.filter(
      (e) => e.message.includes("EVs") && e.message.includes("between")
    );
    expect(singleEvErrors).toHaveLength(0);
  });

  // --- Error shape ---

  it("returns correctly shaped error objects", () => {
    const team = makeTeam({
      slots: [
        makeSlot("", { position: 1, moves: [undefined, undefined, undefined, undefined] }),
      ],
    });

    const result = validateTeam(team);

    for (const error of result.errors) {
      expect(error).toHaveProperty("field");
      expect(error).toHaveProperty("message");
      expect(typeof error.field).toBe("string");
      expect(typeof error.message).toBe("string");
    }
  });
});
