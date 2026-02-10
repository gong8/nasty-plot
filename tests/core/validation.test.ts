import { validateTeam } from "@nasty-plot/core";
import type { TeamData, TeamSlotData, StatsTable } from "@nasty-plot/core";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeEvs(overrides: Partial<StatsTable> = {}): StatsTable {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...overrides };
}

function makeSlot(overrides: Partial<TeamSlotData> = {}): TeamSlotData {
  return {
    position: 1,
    pokemonId: "greatTusk",
    ability: "Protosynthesis",
    item: "Booster Energy",
    nature: "Jolly",
    level: 100,
    moves: ["Headlong Rush", "Close Combat", "Knock Off", "Rapid Spin"],
    evs: makeEvs({ atk: 252, spe: 252, hp: 4 }),
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    ...overrides,
  };
}

function makeTeam(slots: TeamSlotData[]): TeamData {
  return {
    id: "test-team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    slots,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// validateTeam
// ---------------------------------------------------------------------------

describe("validateTeam", () => {
  // -------------------------------------------------------------------------
  // Valid teams
  // -------------------------------------------------------------------------

  it("returns valid for a single valid slot", () => {
    const team = makeTeam([makeSlot()]);
    const result = validateTeam(team);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid for a full team of 6 unique Pokemon with unique items", () => {
    const team = makeTeam([
      makeSlot({ position: 1, pokemonId: "greatTusk", item: "Booster Energy" }),
      makeSlot({ position: 2, pokemonId: "ironValiant", item: "Choice Specs" }),
      makeSlot({ position: 3, pokemonId: "gholdengo", item: "Air Balloon" }),
      makeSlot({ position: 4, pokemonId: "dragapult", item: "Choice Band" }),
      makeSlot({ position: 5, pokemonId: "garganacl", item: "Leftovers" }),
      makeSlot({ position: 6, pokemonId: "clodsire", item: "Black Sludge" }),
    ]);
    const result = validateTeam(team);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid for an empty team (no slots)", () => {
    const team = makeTeam([]);
    const result = validateTeam(team);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Species clause
  // -------------------------------------------------------------------------

  describe("species clause", () => {
    it("detects duplicate pokemonId", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "greatTusk" }),
        makeSlot({ position: 2, pokemonId: "greatTusk", item: "Leftovers" }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const speciesError = result.errors.find((e) => e.message.includes("Duplicate species"));
      expect(speciesError).toBeDefined();
      expect(speciesError!.field).toBe("slot.2.pokemonId");
      expect(speciesError!.message).toContain("greatTusk");
    });

    it("flags all duplicates when the same species appears three times", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "gholdengo", item: "Air Balloon" }),
        makeSlot({ position: 2, pokemonId: "gholdengo", item: "Choice Specs" }),
        makeSlot({ position: 3, pokemonId: "gholdengo", item: "Leftovers" }),
      ]);
      const result = validateTeam(team);
      const speciesErrors = result.errors.filter((e) => e.message.includes("Duplicate species"));
      expect(speciesErrors).toHaveLength(2);
      expect(speciesErrors[0].field).toBe("slot.2.pokemonId");
      expect(speciesErrors[1].field).toBe("slot.3.pokemonId");
    });

    it("allows different Pokemon with no species conflict", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "greatTusk" }),
        makeSlot({ position: 2, pokemonId: "ironValiant", item: "Choice Specs" }),
      ]);
      const speciesErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Duplicate species")
      );
      expect(speciesErrors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Item clause
  // -------------------------------------------------------------------------

  describe("item clause", () => {
    it("detects duplicate items", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "greatTusk", item: "Leftovers" }),
        makeSlot({ position: 2, pokemonId: "ironValiant", item: "Leftovers" }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const itemError = result.errors.find((e) => e.message.includes("Duplicate item"));
      expect(itemError).toBeDefined();
      expect(itemError!.field).toBe("slot.2.item");
      expect(itemError!.message).toContain("Leftovers");
    });

    it("skips empty string items (no duplicate flagged)", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "greatTusk", item: "" }),
        makeSlot({ position: 2, pokemonId: "ironValiant", item: "" }),
      ]);
      const itemErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Duplicate item")
      );
      expect(itemErrors).toHaveLength(0);
    });

    it("skips whitespace-only items (no duplicate flagged)", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "greatTusk", item: "   " }),
        makeSlot({ position: 2, pokemonId: "ironValiant", item: "  " }),
      ]);
      const itemErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Duplicate item")
      );
      expect(itemErrors).toHaveLength(0);
    });

    it("skips undefined items (no duplicate flagged)", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "greatTusk", item: undefined as unknown as string }),
        makeSlot({ position: 2, pokemonId: "ironValiant", item: undefined as unknown as string }),
      ]);
      const itemErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Duplicate item")
      );
      expect(itemErrors).toHaveLength(0);
    });

    it("flags all duplicates when three slots share the same item", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "greatTusk", item: "Leftovers" }),
        makeSlot({ position: 2, pokemonId: "ironValiant", item: "Leftovers" }),
        makeSlot({ position: 3, pokemonId: "gholdengo", item: "Leftovers" }),
      ]);
      const itemErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Duplicate item")
      );
      expect(itemErrors).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // EV total validation
  // -------------------------------------------------------------------------

  describe("EV total", () => {
    it("flags slots with EV total exceeding 510", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          evs: makeEvs({ hp: 252, atk: 252, spe: 252 }), // 756 > 510
        }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const evError = result.errors.find((e) => e.message.includes("EV total"));
      expect(evError).toBeDefined();
      expect(evError!.field).toBe("slot.1.evs");
      expect(evError!.message).toContain("756");
      expect(evError!.message).toContain("510");
    });

    it("allows exactly 510 total EVs", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          evs: makeEvs({ hp: 252, atk: 252, def: 4, spe: 2 }), // 510
        }),
      ]);
      const evErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("EV total")
      );
      expect(evErrors).toHaveLength(0);
    });

    it("allows 508 total EVs (standard competitive spread)", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          evs: makeEvs({ hp: 4, atk: 252, spe: 252 }), // 508
        }),
      ]);
      const evErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("EV total")
      );
      expect(evErrors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Individual EV validation
  // -------------------------------------------------------------------------

  describe("individual EV values", () => {
    it("flags negative EV values", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          evs: makeEvs({ atk: -4 }),
        }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const evError = result.errors.find((e) => e.field.includes("evs.atk"));
      expect(evError).toBeDefined();
      expect(evError!.message).toContain("atk");
      expect(evError!.message).toContain("-4");
    });

    it("flags EV values over 252", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          evs: makeEvs({ spe: 300 }),
        }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const evError = result.errors.find((e) => e.field.includes("evs.spe"));
      expect(evError).toBeDefined();
      expect(evError!.message).toContain("spe");
      expect(evError!.message).toContain("300");
    });

    it("allows EV of exactly 0", () => {
      const team = makeTeam([
        makeSlot({ position: 1, evs: makeEvs() }),
      ]);
      const evStatErrors = validateTeam(team).errors.filter((e) =>
        e.field.includes("evs.") && e.message.includes("must be between")
      );
      expect(evStatErrors).toHaveLength(0);
    });

    it("allows EV of exactly 252", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          evs: makeEvs({ hp: 252 }),
        }),
      ]);
      const evStatErrors = validateTeam(team).errors.filter((e) =>
        e.field.includes("evs.") && e.message.includes("must be between")
      );
      expect(evStatErrors).toHaveLength(0);
    });

    it("reports errors for multiple invalid EVs on the same slot", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          evs: { hp: -1, atk: 300, def: 0, spa: 0, spd: 0, spe: -10 },
        }),
      ]);
      const result = validateTeam(team);
      const evStatErrors = result.errors.filter((e) =>
        e.message.includes("must be between")
      );
      expect(evStatErrors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // -------------------------------------------------------------------------
  // Move validation
  // -------------------------------------------------------------------------

  describe("moves", () => {
    it("flags a slot with no moves", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          moves: [undefined as unknown as string, undefined, undefined, undefined],
        }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const moveError = result.errors.find((e) => e.message.includes("at least one move"));
      expect(moveError).toBeDefined();
      expect(moveError!.field).toBe("slot.1.moves");
    });

    it("flags a slot with empty string as first move", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          moves: ["", undefined, undefined, undefined],
        }),
      ]);
      const result = validateTeam(team);
      const moveError = result.errors.find((e) => e.message.includes("at least one move"));
      expect(moveError).toBeDefined();
    });

    it("allows a slot with just one move", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          moves: ["Earthquake", undefined, undefined, undefined],
        }),
      ]);
      const moveErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("at least one move")
      );
      expect(moveErrors).toHaveLength(0);
    });

    it("allows a slot with all four moves", () => {
      const team = makeTeam([makeSlot()]);
      const moveErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("at least one move")
      );
      expect(moveErrors).toHaveLength(0);
    });

    it("flags duplicate moves on the same slot", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          moves: ["Earthquake", "Swords Dance", "Earthquake", "Rock Slide"],
        }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const dupError = result.errors.find((e) => e.message.includes("Duplicate move"));
      expect(dupError).toBeDefined();
      expect(dupError!.field).toBe("slot.1.moves.2");
      expect(dupError!.message).toContain("Earthquake");
    });

    it("flags duplicate moves case-insensitively", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          moves: ["Earthquake", "earthquake", undefined, undefined],
        }),
      ]);
      const result = validateTeam(team);
      const dupErrors = result.errors.filter((e) => e.message.includes("Duplicate move"));
      expect(dupErrors).toHaveLength(1);
    });

    it("allows all unique moves", () => {
      const team = makeTeam([makeSlot()]);
      const dupErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Duplicate move")
      );
      expect(dupErrors).toHaveLength(0);
    });

    it("skips undefined moves when checking duplicates", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          moves: ["Earthquake", undefined, undefined, undefined],
        }),
      ]);
      const dupErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Duplicate move")
      );
      expect(dupErrors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Pokemon selection validation
  // -------------------------------------------------------------------------

  describe("pokemon selection", () => {
    it("flags a slot with empty pokemonId", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "" }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const pokeError = result.errors.find((e) => e.message.includes("Must select a Pokemon"));
      expect(pokeError).toBeDefined();
      expect(pokeError!.field).toBe("slot.1.pokemonId");
    });

    it("does not flag a slot with a valid pokemonId", () => {
      const team = makeTeam([makeSlot()]);
      const pokeErrors = validateTeam(team).errors.filter((e) =>
        e.message.includes("Must select a Pokemon")
      );
      expect(pokeErrors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple errors combined
  // -------------------------------------------------------------------------

  describe("multiple errors", () => {
    it("accumulates errors from multiple validation rules", () => {
      const team = makeTeam([
        makeSlot({
          position: 1,
          pokemonId: "greatTusk",
          item: "Leftovers",
          moves: ["Earthquake"],
          evs: makeEvs({ hp: 252, atk: 252, spe: 252 }), // EV total > 510
        }),
        makeSlot({
          position: 2,
          pokemonId: "greatTusk", // duplicate species
          item: "Leftovers",     // duplicate item
          moves: ["", undefined, undefined, undefined], // no move
          evs: makeEvs({ atk: 300 }), // EV out of range
        }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      // Should have: duplicate species, duplicate item, EV total on slot 1,
      // EV out of range on slot 2, no move on slot 2
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it("returns valid: true only when there are zero errors", () => {
      const team = makeTeam([makeSlot()]);
      const result = validateTeam(team);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("returns valid: false when there is at least one error", () => {
      const team = makeTeam([
        makeSlot({ position: 1, pokemonId: "" }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Field path accuracy
  // -------------------------------------------------------------------------

  describe("error field paths", () => {
    it("uses correct position in field path for species errors", () => {
      const team = makeTeam([
        makeSlot({ position: 3, pokemonId: "pikachu", item: "Light Ball" }),
        makeSlot({ position: 5, pokemonId: "pikachu", item: "Choice Band" }),
      ]);
      const result = validateTeam(team);
      const speciesError = result.errors.find((e) => e.message.includes("Duplicate species"));
      expect(speciesError!.field).toBe("slot.5.pokemonId");
    });

    it("uses correct position in field path for item errors", () => {
      const team = makeTeam([
        makeSlot({ position: 2, pokemonId: "greatTusk", item: "Leftovers" }),
        makeSlot({ position: 4, pokemonId: "ironValiant", item: "Leftovers" }),
      ]);
      const result = validateTeam(team);
      const itemError = result.errors.find((e) => e.message.includes("Duplicate item"));
      expect(itemError!.field).toBe("slot.4.item");
    });

    it("uses correct position in field path for EV errors", () => {
      const team = makeTeam([
        makeSlot({
          position: 6,
          evs: makeEvs({ hp: 300 }),
        }),
      ]);
      const result = validateTeam(team);
      const evError = result.errors.find((e) => e.field.includes("evs"));
      expect(evError!.field).toContain("slot.6");
    });
  });
});
