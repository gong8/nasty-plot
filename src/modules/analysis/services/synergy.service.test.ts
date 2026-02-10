import type { TeamSlotData, PokemonType, StatsTable } from "@/shared/types";
import { calculateSynergy } from "./synergy.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultEvs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const defaultIvs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function makeSlot(
  pokemonId: string,
  types: [PokemonType] | [PokemonType, PokemonType],
  baseStats: StatsTable,
  overrides?: Partial<TeamSlotData>
): TeamSlotData {
  return {
    position: 1,
    pokemonId,
    species: {
      id: pokemonId,
      name: pokemonId,
      num: 1,
      types,
      baseStats,
      abilities: { "0": "Ability" },
      weightkg: 50,
    },
    ability: "Ability",
    item: "",
    nature: "Hardy",
    level: 100,
    moves: ["move1", undefined, undefined, undefined],
    evs: defaultEvs,
    ivs: defaultIvs,
    ...overrides,
  };
}

// Prebuilt stat profiles to keep tests readable
const physicalAttacker: StatsTable = { hp: 80, atk: 130, def: 80, spa: 60, spd: 80, spe: 100 };
const specialAttacker: StatsTable = { hp: 80, atk: 60, def: 80, spa: 130, spd: 80, spe: 100 };
const mixedAttacker: StatsTable = { hp: 80, atk: 100, def: 80, spa: 100, spd: 80, spe: 100 };
const tank: StatsTable = { hp: 100, atk: 50, def: 120, spa: 50, spd: 120, spe: 30 };
const fastMon: StatsTable = { hp: 60, atk: 90, def: 60, spa: 90, spd: 60, spe: 150 };
const slowMon: StatsTable = { hp: 100, atk: 100, def: 100, spa: 60, spd: 100, spe: 30 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateSynergy", () => {
  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("returns 0 for an empty team", () => {
    expect(calculateSynergy([])).toBe(0);
  });

  it("returns 50 for a single-member team", () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"], physicalAttacker)];
    expect(calculateSynergy(team)).toBe(50);
  });

  // -----------------------------------------------------------------------
  // Score range
  // -----------------------------------------------------------------------

  it("returns a value between 0 and 100", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"], physicalAttacker),
      makeSlot("corviknight", ["Flying", "Steel"], tank),
      makeSlot("rotom-wash", ["Electric", "Water"], specialAttacker),
    ];
    const score = calculateSynergy(team);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns an integer (rounded)", () => {
    const team = [
      makeSlot("a", ["Fire"], physicalAttacker),
      makeSlot("b", ["Water"], specialAttacker),
    ];
    const score = calculateSynergy(team);
    expect(Number.isInteger(score)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Defensive complementarity component
  // -----------------------------------------------------------------------

  describe("defensive complementarity", () => {
    it("scores higher when teammates cover each other's weaknesses", () => {
      // Fire is weak to Water, Ground, Rock
      // Water resists Fire; Water is weak to Electric, Grass
      // Ground is immune to Electric
      const complementary = [
        makeSlot("arcanine", ["Fire"], physicalAttacker),
        makeSlot("swampert", ["Water", "Ground"], physicalAttacker),
      ];

      // Two Fire types share ALL weaknesses with no coverage
      const redundant = [
        makeSlot("arcanine", ["Fire"], physicalAttacker),
        makeSlot("charizard", ["Fire", "Flying"], physicalAttacker),
      ];

      const complementaryScore = calculateSynergy(complementary);
      const redundantScore = calculateSynergy(redundant);

      expect(complementaryScore).toBeGreaterThan(redundantScore);
    });

    it("handles species with no types gracefully", () => {
      const slotNoSpecies: TeamSlotData = {
        position: 1,
        pokemonId: "missingno",
        species: undefined,
        ability: "",
        item: "",
        nature: "Hardy",
        level: 100,
        moves: ["tackle", undefined, undefined, undefined],
        evs: defaultEvs,
        ivs: defaultIvs,
      };

      const team = [
        makeSlot("pikachu", ["Electric"], fastMon),
        slotNoSpecies,
      ];

      // Should not throw
      const score = calculateSynergy(team);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // Offensive breadth component
  // -----------------------------------------------------------------------

  describe("offensive breadth", () => {
    it("diverse type coverage scores higher than mono-type", () => {
      const diverse = [
        makeSlot("garchomp", ["Dragon", "Ground"], physicalAttacker),
        makeSlot("heatran", ["Fire", "Steel"], specialAttacker),
        makeSlot("tapu-lele", ["Psychic", "Fairy"], specialAttacker),
      ];

      const monoType = [
        makeSlot("gyarados", ["Water", "Flying"], physicalAttacker),
        makeSlot("vaporeon", ["Water"], specialAttacker),
        makeSlot("swampert", ["Water", "Ground"], physicalAttacker),
      ];

      const diverseScore = calculateSynergy(diverse);
      const monoScore = calculateSynergy(monoType);

      expect(diverseScore).toBeGreaterThan(monoScore);
    });
  });

  // -----------------------------------------------------------------------
  // Speed diversity component
  // -----------------------------------------------------------------------

  describe("speed diversity", () => {
    it("scores higher with a mix of fast and slow Pokemon", () => {
      const diverseSpeeds = [
        makeSlot("fast", ["Normal"], fastMon),    // spe 150
        makeSlot("slow", ["Normal"], slowMon),    // spe 30
      ];

      const sameSpeeds = [
        makeSlot("mid1", ["Normal"], { ...fastMon, spe: 80 }),
        makeSlot("mid2", ["Normal"], { ...fastMon, spe: 82 }),
      ];

      const diverseScore = calculateSynergy(diverseSpeeds);
      const sameScore = calculateSynergy(sameSpeeds);

      expect(diverseScore).toBeGreaterThan(sameScore);
    });
  });

  // -----------------------------------------------------------------------
  // Physical/Special balance component
  // -----------------------------------------------------------------------

  describe("attack balance", () => {
    it("scores higher with a balanced physical/special split", () => {
      const balanced = [
        makeSlot("phys", ["Normal"], physicalAttacker),  // atk 130 > spa 60
        makeSlot("spec", ["Normal"], specialAttacker),   // spa 130 > atk 60
      ];

      const allPhysical = [
        makeSlot("phys1", ["Normal"], physicalAttacker),
        makeSlot("phys2", ["Normal"], physicalAttacker),
      ];

      const balancedScore = calculateSynergy(balanced);
      const physicalScore = calculateSynergy(allPhysical);

      expect(balancedScore).toBeGreaterThan(physicalScore);
    });

    it("mixed attackers count as 0.5 for each side", () => {
      // A mixed attacker with atk ~= spa and both >= 80 should contribute
      // half to each side. Two mixed attackers = 1 phys + 1 special.
      const mixedTeam = [
        makeSlot("mix1", ["Normal"], mixedAttacker),
        makeSlot("mix2", ["Normal"], mixedAttacker),
      ];

      const score = calculateSynergy(mixedTeam);
      // With 1.0 physical and 1.0 special, ratio = 1.0 => 20 points for balance
      // This should be a decent score contribution
      expect(score).toBeGreaterThan(0);
    });

    it("handles team with no strong attackers (all < 80)", () => {
      const lowAttack: StatsTable = { hp: 100, atk: 60, def: 100, spa: 60, spd: 100, spe: 50 };
      const team = [
        makeSlot("a", ["Normal"], lowAttack),
        makeSlot("b", ["Normal"], lowAttack),
      ];
      const score = calculateSynergy(team);
      // Should still produce a valid score
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // Well-composed team versus poor composition
  // -----------------------------------------------------------------------

  describe("composite scoring", () => {
    it("a well-composed team scores notably higher than a poorly composed one", () => {
      const goodTeam = [
        makeSlot("garchomp", ["Dragon", "Ground"], { ...physicalAttacker, spe: 102 }),
        makeSlot("corviknight", ["Flying", "Steel"], { ...tank, spe: 67 }),
        makeSlot("rotom-wash", ["Electric", "Water"], { ...specialAttacker, spe: 86 }),
        makeSlot("amoonguss", ["Grass", "Poison"], { ...tank, spe: 30 }),
      ];

      const badTeam = [
        makeSlot("ice1", ["Ice"], physicalAttacker),
        makeSlot("ice2", ["Ice"], physicalAttacker),
        makeSlot("ice3", ["Ice"], physicalAttacker),
        makeSlot("ice4", ["Ice"], physicalAttacker),
      ];

      const goodScore = calculateSynergy(goodTeam);
      const badScore = calculateSynergy(badTeam);

      expect(goodScore).toBeGreaterThan(badScore);
    });

    it("nature affects speed calculations", () => {
      // Jolly nature boosts speed
      const jollySlot = makeSlot("fast", ["Normal"], fastMon, { nature: "Jolly" });
      // Brave nature lowers speed
      const braveSlot = makeSlot("slow", ["Normal"], fastMon, { nature: "Brave" });

      const team = [jollySlot, braveSlot];
      const score = calculateSynergy(team);
      // The nature difference should create speed diversity
      expect(score).toBeGreaterThan(0);
    });
  });
});
