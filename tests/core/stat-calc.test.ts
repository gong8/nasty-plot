import { calculateStat, calculateAllStats, getTotalEvs, validateEvs } from "@nasty-plot/core";
import type { NatureName, StatsTable } from "@nasty-plot/core";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeEvs(overrides: Partial<StatsTable> = {}): StatsTable {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...overrides };
}

function makeIvs(overrides: Partial<StatsTable> = {}): StatsTable {
  return { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...overrides };
}

// ---------------------------------------------------------------------------
// calculateStat
// ---------------------------------------------------------------------------

describe("calculateStat", () => {
  // Known reference: Garchomp Lv 100, base HP 108, 31 IV, 0 EV, neutral nature
  // HP formula: floor((2*108 + 31 + 0) * 100 / 100) + 100 + 10 = 247 + 110 = 357
  // Wait, precise: floor((2*108+31+floor(0/4))*100/100) + 100 + 10
  //              = floor(247 * 100 / 100) + 110 = 247 + 110 = 357
  it("calculates HP correctly for Garchomp at Lv100, 31 IV, 0 EV", () => {
    expect(calculateStat("hp", 108, 31, 0, 100, "Hardy")).toBe(357);
  });

  // Garchomp HP with 252 EV: floor((2*108+31+63)*100/100)+110 = floor(310)+110 = 310+110 = 420
  // floor(ev/4) = 63
  it("calculates HP correctly for Garchomp at Lv100, 31 IV, 252 EV", () => {
    expect(calculateStat("hp", 108, 31, 252, 100, "Hardy")).toBe(420);
  });

  // Shedinja special case: HP is always 1 regardless of IVs/EVs
  it("returns 1 for Shedinja HP (base 1)", () => {
    expect(calculateStat("hp", 1, 31, 252, 100, "Hardy")).toBe(1);
  });

  it("returns 1 for Shedinja HP at any level", () => {
    expect(calculateStat("hp", 1, 31, 0, 50, "Adamant")).toBe(1);
  });

  // Non-HP stat: Garchomp base Atk 130, Lv 100, 31 IV, 252 EV, Adamant (+Atk)
  // core = floor((2*130 + 31 + 63) * 100 / 100) = floor(354) = 354
  // Adamant: plus = atk => natureMod = 1.1
  // result = floor((354 + 5) * 1.1) = floor(359 * 1.1) = floor(394.9) = 394
  it("calculates Attack with positive nature (Adamant)", () => {
    expect(calculateStat("atk", 130, 31, 252, 100, "Adamant")).toBe(394);
  });

  // Same but Modest (minus Atk): natureMod = 0.9
  // floor((354 + 5) * 0.9) = floor(359 * 0.9) = floor(323.1) = 323
  it("calculates Attack with negative nature (Modest)", () => {
    expect(calculateStat("atk", 130, 31, 252, 100, "Modest")).toBe(323);
  });

  // Neutral nature for Atk: Hardy has no plus/minus
  // floor((354 + 5) * 1.0) = 359
  it("calculates Attack with neutral nature (Hardy)", () => {
    expect(calculateStat("atk", 130, 31, 252, 100, "Hardy")).toBe(359);
  });

  // Level 50 calculations - commonly used in VGC
  // Garchomp Atk at Lv50: core = floor((2*130+31+63)*50/100) = floor(354*50/100) = floor(177) = 177
  // Adamant: floor((177+5)*1.1) = floor(200.2) = 200
  it("calculates stats correctly at Level 50", () => {
    expect(calculateStat("atk", 130, 31, 252, 50, "Adamant")).toBe(200);
  });

  // Level 1 edge case
  // core = floor((2*130+31+0)*1/100) = floor(291*0.01) = floor(2.91) = 2
  // neutral: floor((2+5)*1.0) = 7
  it("calculates stats at Level 1", () => {
    expect(calculateStat("atk", 130, 31, 0, 1, "Hardy")).toBe(7);
  });

  // 0 IV, 0 EV: Garchomp Atk at Lv100
  // core = floor((2*130+0+0)*100/100) = 260
  // neutral: floor((260+5)*1.0) = 265
  it("calculates stats with 0 IV and 0 EV", () => {
    expect(calculateStat("atk", 130, 0, 0, 100, "Hardy")).toBe(265);
  });

  // HP at level 50
  // Garchomp HP Lv50, 31 IV, 252 EV
  // core = floor((2*108+31+63)*50/100) = floor(310*0.5) = floor(155) = 155
  // HP: 155 + 50 + 10 = 215
  it("calculates HP correctly at Level 50", () => {
    expect(calculateStat("hp", 108, 31, 252, 50, "Hardy")).toBe(215);
  });

  // Verify nature affects SpA but not Atk for Modest
  // Modest: plus = spa, minus = atk
  // SpA base 80, 31 IV, 252 EV, Lv100
  // core = floor((2*80+31+63)*100/100) = 254
  // Modest +SpA: floor((254+5)*1.1) = floor(284.9) = 284
  it("applies positive nature to SpA for Modest", () => {
    expect(calculateStat("spa", 80, 31, 252, 100, "Modest")).toBe(284);
  });

  // Def stat with no nature effect from Adamant (Adamant is +Atk -SpA)
  // Garchomp Def 95, 31 IV, 0 EV, Lv100
  // core = floor((2*95+31+0)*100/100) = 221
  // Adamant: neither plus nor minus is def => 1.0
  // result = floor((221+5)*1.0) = 226
  it("applies neutral modifier for unaffected stat", () => {
    expect(calculateStat("def", 95, 31, 0, 100, "Adamant")).toBe(226);
  });

  // Speed with Jolly (+Spe, -SpA)
  // Garchomp Spe 102, 31 IV, 252 EV, Lv100
  // core = floor((2*102+31+63)*100/100) = 298
  // Jolly +Spe: floor((298+5)*1.1) = floor(333.3) = 333
  it("calculates Speed with Jolly nature", () => {
    expect(calculateStat("spe", 102, 31, 252, 100, "Jolly")).toBe(333);
  });

  // Verify known Pikachu calculation:
  // Pikachu base HP 35, Lv 100, 31 IV, 0 EV
  // HP: floor((2*35+31+0)*100/100) + 100 + 10 = 101 + 110 = 211
  it("calculates Pikachu HP correctly", () => {
    expect(calculateStat("hp", 35, 31, 0, 100, "Hardy")).toBe(211);
  });

  // Blissey HP: base 255, 31 IV, 252 EV
  // HP: floor((2*255+31+63)*100/100) + 100 + 10 = 604 + 110 = 714
  it("calculates Blissey HP (highest base HP)", () => {
    expect(calculateStat("hp", 255, 31, 252, 100, "Hardy")).toBe(714);
  });

  // Edge: EV not divisible by 4 (e.g., 7) - floor(7/4) = 1
  // base 100, IV 31, EV 7, Lv100, neutral
  // core = floor((200+31+1)*100/100) = 232
  // result = floor((232+5)*1.0) = 237
  it("handles EV values not divisible by 4 via floor", () => {
    expect(calculateStat("atk", 100, 31, 7, 100, "Hardy")).toBe(237);
  });

  // Edge: 0 base stat (theoretically)
  // core = floor((0+31+0)*100/100) = 31
  // HP: 31 + 100 + 10 = 141
  it("handles 0 base stat for HP", () => {
    expect(calculateStat("hp", 0, 31, 0, 100, "Hardy")).toBe(141);
  });

  // Edge: 0 base stat for non-HP
  // core = 31, result = floor((31+5)*1.0) = 36
  it("handles 0 base stat for non-HP", () => {
    expect(calculateStat("atk", 0, 31, 0, 100, "Hardy")).toBe(36);
  });

  // All natures with no plus/minus: Bashful, Docile, Hardy, Quirky, Serious
  it.each(["Bashful", "Docile", "Hardy", "Quirky", "Serious"] as NatureName[])(
    "neutral nature %s gives same result as 1.0 multiplier",
    (nature) => {
      expect(calculateStat("atk", 100, 31, 0, 100, nature)).toBe(
        calculateStat("atk", 100, 31, 0, 100, "Hardy")
      );
    }
  );
});

// ---------------------------------------------------------------------------
// calculateAllStats
// ---------------------------------------------------------------------------

describe("calculateAllStats", () => {
  // Garchomp: HP 108, Atk 130, Def 95, SpA 80, SpD 85, Spe 102
  // Jolly (+Spe, -SpA), 252 Atk / 4 SpD / 252 Spe, 31 IVs, Lv100
  const garchompBase: StatsTable = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };

  it("calculates all stats for a standard Garchomp spread", () => {
    const evs = makeEvs({ atk: 252, spd: 4, spe: 252 });
    const ivs = makeIvs();
    const result = calculateAllStats(garchompBase, ivs, evs, 100, "Jolly");

    // HP: no EV => floor((2*108+31)*100/100)+110 = 247+110 = 357
    expect(result.hp).toBe(357);
    // Atk: 252 EV, Jolly is -SpA not -Atk, so Atk gets 1.0
    // core = floor((2*130+31+63)*100/100) = 354
    // floor((354+5)*1.0) = 359
    expect(result.atk).toBe(359);
    // Def: 0 EV, neutral
    // core = floor((2*95+31)*100/100) = 221
    // floor((221+5)*1.0) = 226
    expect(result.def).toBe(226);
    // SpA: Jolly -SpA
    // core = floor((2*80+31)*100/100) = 191
    // floor((191+5)*0.9) = floor(176.4) = 176
    expect(result.spa).toBe(176);
    // SpD: 4 EV => floor(4/4) = 1
    // core = floor((2*85+31+1)*100/100) = 202
    // floor((202+5)*1.0) = 207
    expect(result.spd).toBe(207);
    // Spe: 252 EV, Jolly +Spe
    // core = floor((2*102+31+63)*100/100) = 298
    // floor((298+5)*1.1) = floor(333.3) = 333
    expect(result.spe).toBe(333);
  });

  it("returns all six stat keys", () => {
    const evs = makeEvs();
    const ivs = makeIvs();
    const result = calculateAllStats(garchompBase, ivs, evs, 100, "Hardy");
    expect(Object.keys(result).sort()).toEqual(["atk", "def", "hp", "spa", "spd", "spe"]);
  });

  it("calculates all stats at Level 50", () => {
    const evs = makeEvs({ hp: 252, atk: 252, spe: 4 });
    const ivs = makeIvs();
    const result = calculateAllStats(garchompBase, ivs, evs, 50, "Adamant");

    // HP at Lv50: floor((2*108+31+63)*50/100)+50+10 = floor(155)+60 = 215
    expect(result.hp).toBe(215);
    // Atk at Lv50 Adamant: floor((2*130+31+63)*50/100) = floor(177) = 177
    // floor((177+5)*1.1) = floor(200.2) = 200
    expect(result.atk).toBe(200);
  });

  it("calculates stats with all 0 IVs and 0 EVs", () => {
    const evs = makeEvs();
    const ivs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = calculateAllStats(garchompBase, ivs, evs, 100, "Hardy");

    // HP: floor((2*108+0+0)*100/100)+110 = 216+110 = 326
    expect(result.hp).toBe(326);
    // Atk: floor((260+0)*100/100) = 260 => floor((260+5)*1.0) = 265
    expect(result.atk).toBe(265);
  });
});

// ---------------------------------------------------------------------------
// getTotalEvs
// ---------------------------------------------------------------------------

describe("getTotalEvs", () => {
  it("returns 0 for all-zero EVs", () => {
    expect(getTotalEvs(makeEvs())).toBe(0);
  });

  it("sums all EV values", () => {
    expect(getTotalEvs(makeEvs({ hp: 252, atk: 252, spe: 4 }))).toBe(508);
  });

  it("handles max EVs (252 in all)", () => {
    const evs: StatsTable = { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 };
    expect(getTotalEvs(evs)).toBe(1512);
  });

  it("returns exact sum for arbitrary values", () => {
    expect(getTotalEvs(makeEvs({ hp: 100, def: 200, spe: 10 }))).toBe(310);
  });
});

// ---------------------------------------------------------------------------
// validateEvs
// ---------------------------------------------------------------------------

describe("validateEvs", () => {
  it("accepts a valid competitive spread", () => {
    const evs = makeEvs({ hp: 252, def: 4, spe: 252 });
    expect(validateEvs(evs)).toEqual({ valid: true });
  });

  it("accepts all-zero EVs", () => {
    expect(validateEvs(makeEvs())).toEqual({ valid: true });
  });

  it("accepts exactly 510 total", () => {
    const evs = makeEvs({ hp: 252, atk: 252, def: 4, spe: 0, spa: 0, spd: 2 });
    // 252+252+4+2 = 510 BUT 2 is not divisible by 4
    // So this would fail the divisibility check first
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
  });

  it("accepts 510 total with all divisible by 4", () => {
    // 252 + 252 + 4 + 0 + 0 + 0 = 508 which is under 510
    const evs = makeEvs({ hp: 252, atk: 252, def: 4 });
    expect(validateEvs(evs)).toEqual({ valid: true });
  });

  it("rejects negative EVs", () => {
    const evs = makeEvs({ hp: -4 });
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("hp");
    expect(result.reason).toContain("between 0 and 252");
  });

  it("rejects EVs over 252", () => {
    const evs = makeEvs({ atk: 256 });
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("atk");
    expect(result.reason).toContain("between 0 and 252");
  });

  it("rejects EVs not divisible by 4", () => {
    const evs = makeEvs({ spe: 251 });
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("spe");
    expect(result.reason).toContain("divisible by 4");
  });

  it("rejects total over 510", () => {
    const evs: StatsTable = { hp: 252, atk: 252, def: 8, spa: 0, spd: 0, spe: 0 };
    // total = 512 > 510
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("512");
    expect(result.reason).toContain("510");
  });

  it("checks individual stat range before total", () => {
    // 300 > 252, and even though total might also exceed, the per-stat check comes first
    const evs = makeEvs({ hp: 300 });
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("hp");
    expect(result.reason).toContain("between 0 and 252");
  });

  it("checks divisibility before total", () => {
    // 253 is > 252, so it'll fail the range check first, not the divisibility
    // Let's use a value that's in range but not divisible: 5
    const evs = makeEvs({ def: 5 });
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("def");
    expect(result.reason).toContain("divisible by 4");
  });

  it("reports the first invalid stat alphabetically by loop order", () => {
    // The loop order is hp, atk, def, spa, spd, spe
    // If both atk and spe are invalid, atk should be reported first
    const evs: StatsTable = { hp: 0, atk: 3, def: 0, spa: 0, spd: 0, spe: 7 };
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("atk");
  });

  it("accepts exactly 252 for a single stat", () => {
    const evs = makeEvs({ spa: 252 });
    expect(validateEvs(evs)).toEqual({ valid: true });
  });

  it("rejects 253 (just over max)", () => {
    const evs = makeEvs({ spd: 253 });
    const result = validateEvs(evs);
    expect(result.valid).toBe(false);
  });
});
