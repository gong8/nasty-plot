import type { TeamData, TeamSlotData, StatsTable } from "@/shared/types";
import { validateTeam } from "./validation.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvs(overrides: Partial<StatsTable> = {}): StatsTable {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...overrides };
}

function makeIvs(): StatsTable {
  return { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
}

function makeSlot(overrides: Partial<TeamSlotData> = {}): TeamSlotData {
  return {
    position: 1,
    pokemonId: "garchomp",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    level: 100,
    moves: ["Earthquake", "Outrage", "Swords Dance", "Scale Shot"],
    evs: makeEvs({ atk: 252, spe: 252, hp: 4 }),
    ivs: makeIvs(),
    ...overrides,
  };
}

function makeTeam(slots: TeamSlotData[]): TeamData {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    slots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateTeam", () => {
  // -----------------------------------------------------------------------
  // Valid teams
  // -----------------------------------------------------------------------

  describe("valid teams", () => {
    it("returns valid for a team with a single legal slot", () => {
      const team = makeTeam([makeSlot()]);
      const result = validateTeam(team);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for a full team of 6 unique Pokemon with unique items", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "Leftovers" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "Choice Band" }),
        makeSlot({ position: 3, pokemonId: "skarmory", item: "Rocky Helmet" }),
        makeSlot({ position: 4, pokemonId: "blissey", item: "Heavy-Duty Boots" }),
        makeSlot({ position: 5, pokemonId: "rotomwash", item: "Choice Scarf" }),
        makeSlot({ position: 6, pokemonId: "clefable", item: "Life Orb" }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid when multiple slots have empty items (item clause ignores empty)", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "" }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid when items are whitespace-only (treated as empty)", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "   " }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "  " }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid for a team with 0 total EVs", () => {
      const team = makeTeam([makeSlot({ evs: makeEvs() })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(true);
    });

    it("returns valid for a team with exactly 510 total EVs", () => {
      const evs = makeEvs({ hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 2 });
      const team = makeTeam([makeSlot({ evs })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(true);
    });

    it("returns valid when a slot has exactly one move", () => {
      const team = makeTeam([
        makeSlot({ moves: ["Earthquake"] }),
      ]);
      const result = validateTeam(team);
      expect(result.valid).toBe(true);
    });

    it("returns valid when an empty team has no slots", () => {
      const team = makeTeam([]);
      const result = validateTeam(team);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Species clause violations
  // -----------------------------------------------------------------------

  describe("species clause", () => {
    it("detects duplicate species across two slots", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp" }),
        makeSlot({ position: 2, pokemonId: "garchomp" }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "slot.2.pokemonId",
          message: expect.stringContaining("Duplicate species"),
        })
      );
    });

    it("detects the second duplicate but not the first occurrence", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp" }),
        makeSlot({ position: 2, pokemonId: "tyranitar" }),
        makeSlot({ position: 3, pokemonId: "garchomp" }),
      ];
      const result = validateTeam(makeTeam(slots));
      const speciesErrors = result.errors.filter((e) => e.message.includes("Duplicate species"));
      expect(speciesErrors).toHaveLength(1);
      expect(speciesErrors[0].field).toBe("slot.3.pokemonId");
    });

    it("detects multiple species appearing more than once", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp" }),
        makeSlot({ position: 2, pokemonId: "tyranitar" }),
        makeSlot({ position: 3, pokemonId: "garchomp" }),
        makeSlot({ position: 4, pokemonId: "tyranitar" }),
      ];
      const result = validateTeam(makeTeam(slots));
      const speciesErrors = result.errors.filter((e) => e.message.includes("Duplicate species"));
      expect(speciesErrors).toHaveLength(2);
    });

    it("reports the correct pokemonId in the error message", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "ironvaliant" }),
        makeSlot({ position: 2, pokemonId: "ironvaliant" }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.errors[0].message).toContain("ironvaliant");
    });
  });

  // -----------------------------------------------------------------------
  // Item clause violations
  // -----------------------------------------------------------------------

  describe("item clause", () => {
    it("detects duplicate items across two slots", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "Leftovers" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "Leftovers" }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "slot.2.item",
          message: expect.stringContaining("Duplicate item"),
        })
      );
    });

    it("reports the correct item name in the error message", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "Choice Scarf" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "Choice Scarf" }),
      ];
      const result = validateTeam(makeTeam(slots));
      const itemError = result.errors.find((e) => e.message.includes("Duplicate item"));
      expect(itemError!.message).toContain("Choice Scarf");
    });

    it("does not flag different items", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "Choice Scarf" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "Choice Band" }),
      ];
      const result = validateTeam(makeTeam(slots));
      const itemErrors = result.errors.filter((e) => e.message.includes("Duplicate item"));
      expect(itemErrors).toHaveLength(0);
    });

    it("does not flag when one item is empty and another is set", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "Leftovers" }),
      ];
      const result = validateTeam(makeTeam(slots));
      const itemErrors = result.errors.filter((e) => e.message.includes("Duplicate item"));
      expect(itemErrors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // EV validation
  // -----------------------------------------------------------------------

  describe("EV validation", () => {
    it("detects total EVs exceeding 510", () => {
      const evs = makeEvs({ hp: 252, atk: 252, def: 252 }); // total = 756
      const team = makeTeam([makeSlot({ evs })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "slot.1.evs",
          message: expect.stringContaining("exceeds maximum"),
        })
      );
    });

    it("includes the actual total in the error message", () => {
      const evs = makeEvs({ hp: 252, atk: 252, spa: 252 }); // total = 756
      const team = makeTeam([makeSlot({ evs })]);
      const result = validateTeam(team);
      const evError = result.errors.find((e) => e.field.endsWith(".evs"));
      expect(evError!.message).toContain("756");
    });

    it("detects a single EV stat exceeding 252", () => {
      const evs = makeEvs({ atk: 253 });
      const team = makeTeam([makeSlot({ evs })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "slot.1.evs.atk",
          message: expect.stringContaining("252"),
        })
      );
    });

    it("detects a negative EV value", () => {
      const evs = makeEvs({ spe: -1 });
      const team = makeTeam([makeSlot({ evs })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "slot.1.evs.spe",
          message: expect.stringContaining("must be between 0 and 252"),
        })
      );
    });

    it("detects individual stat violation even when total is fine", () => {
      const evs = makeEvs({ hp: 255 }); // single stat over 252 but total = 255 < 510
      const team = makeTeam([makeSlot({ evs })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      const singleStatErrors = result.errors.filter((e) => e.field.match(/evs\.\w+$/));
      expect(singleStatErrors.length).toBeGreaterThan(0);
    });

    it("allows exactly 252 in a single stat", () => {
      const evs = makeEvs({ atk: 252 });
      const team = makeTeam([makeSlot({ evs })]);
      const result = validateTeam(team);
      const singleStatErrors = result.errors.filter((e) => e.field.match(/evs\.\w+$/));
      expect(singleStatErrors).toHaveLength(0);
    });

    it("reports EV violations for multiple slots independently", () => {
      const badEvs = makeEvs({ hp: 252, atk: 252, def: 252 });
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", evs: badEvs }),
        makeSlot({ position: 2, pokemonId: "tyranitar", evs: badEvs }),
      ];
      const result = validateTeam(makeTeam(slots));
      const evTotalErrors = result.errors.filter((e) => e.message.includes("exceeds maximum"));
      expect(evTotalErrors).toHaveLength(2);
      expect(evTotalErrors[0].field).toBe("slot.1.evs");
      expect(evTotalErrors[1].field).toBe("slot.2.evs");
    });
  });

  // -----------------------------------------------------------------------
  // Move validation
  // -----------------------------------------------------------------------

  describe("move validation", () => {
    it("detects a slot with no moves (moves[0] is empty string)", () => {
      const team = makeTeam([makeSlot({ moves: [""] })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "slot.1.moves",
          message: "Must have at least one move",
        })
      );
    });

    it("does not flag a slot that has a first move", () => {
      const team = makeTeam([makeSlot({ moves: ["Earthquake"] })]);
      const result = validateTeam(team);
      const moveErrors = result.errors.filter((e) => e.message.includes("at least one move"));
      expect(moveErrors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Missing Pokemon validation
  // -----------------------------------------------------------------------

  describe("missing pokemonId", () => {
    it("detects a slot with no pokemonId", () => {
      const team = makeTeam([makeSlot({ pokemonId: "" })]);
      const result = validateTeam(team);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "slot.1.pokemonId",
          message: "Must select a Pokemon",
        })
      );
    });

    it("does not flag a slot that has a pokemonId", () => {
      const team = makeTeam([makeSlot({ pokemonId: "garchomp" })]);
      const result = validateTeam(team);
      const idErrors = result.errors.filter((e) => e.message.includes("Must select a Pokemon"));
      expect(idErrors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Combined / multiple violations
  // -----------------------------------------------------------------------

  describe("multiple validation errors", () => {
    it("returns all errors when multiple clauses are violated", () => {
      const badEvs = makeEvs({ hp: 255, atk: 255, def: 255 }); // total > 510 + 3 individual > 252
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "Leftovers", evs: badEvs }),
        makeSlot({
          position: 2,
          pokemonId: "garchomp", // species clause
          item: "Leftovers",     // item clause
          evs: badEvs,
          moves: [""],           // no moves
        }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.valid).toBe(false);
      // Should detect: species dupe, item dupe, EV total (x2), individual EVs (x6), no moves (x1)
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it("marks valid: false even when only a single error exists", () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "Leftovers" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "Leftovers" }),
      ];
      const result = validateTeam(makeTeam(slots));
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});
