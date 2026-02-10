import { FORMAT_DEFINITIONS } from "./format-definitions";

// =============================================================================
// FORMAT_DEFINITIONS structural integrity
// =============================================================================

describe("FORMAT_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(FORMAT_DEFINITIONS)).toBe(true);
    expect(FORMAT_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("every format has a unique id", () => {
    const ids = FORMAT_DEFINITIONS.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  describe.each(FORMAT_DEFINITIONS)("format $id", (format) => {
    it("has a non-empty id", () => {
      expect(format.id).toBeTruthy();
      expect(typeof format.id).toBe("string");
      expect(format.id.length).toBeGreaterThan(0);
    });

    it("has a non-empty name", () => {
      expect(format.name).toBeTruthy();
      expect(typeof format.name).toBe("string");
      expect(format.name.length).toBeGreaterThan(0);
    });

    it("has generation set to 9", () => {
      expect(format.generation).toBe(9);
    });

    it('has a valid gameType ("singles" or "doubles")', () => {
      expect(["singles", "doubles"]).toContain(format.gameType);
    });

    it('has a valid dexScope ("sv" or "natdex")', () => {
      expect(["sv", "natdex"]).toContain(format.dexScope);
    });

    it("has teamSize of 6", () => {
      expect(format.teamSize).toBe(6);
    });

    it("has maxLevel as a positive integer", () => {
      expect(format.maxLevel).toBeGreaterThan(0);
      expect(Number.isInteger(format.maxLevel)).toBe(true);
    });

    it("has defaultLevel as a positive integer", () => {
      expect(format.defaultLevel).toBeGreaterThan(0);
      expect(Number.isInteger(format.defaultLevel)).toBe(true);
    });

    it("has defaultLevel <= maxLevel", () => {
      expect(format.defaultLevel).toBeLessThanOrEqual(format.maxLevel);
    });

    it("has rules as a non-empty array of strings", () => {
      expect(Array.isArray(format.rules)).toBe(true);
      expect(format.rules.length).toBeGreaterThan(0);
      for (const rule of format.rules) {
        expect(typeof rule).toBe("string");
        expect(rule.length).toBeGreaterThan(0);
      }
    });

    it("has bans as an array of strings", () => {
      expect(Array.isArray(format.bans)).toBe(true);
      for (const ban of format.bans) {
        expect(typeof ban).toBe("string");
        expect(ban.length).toBeGreaterThan(0);
      }
    });

    it("has isActive as a boolean", () => {
      expect(typeof format.isActive).toBe("boolean");
    });

    it("has no duplicate entries in bans", () => {
      const uniqueBans = new Set(format.bans);
      expect(uniqueBans.size).toBe(format.bans.length);
    });

    it("has no duplicate entries in rules", () => {
      const uniqueRules = new Set(format.rules);
      expect(uniqueRules.size).toBe(format.rules.length);
    });

    if (format.restricted) {
      it("restricted field (if present) is an array of non-empty strings", () => {
        expect(Array.isArray(format.restricted)).toBe(true);
        for (const entry of format.restricted!) {
          expect(typeof entry).toBe("string");
          expect(entry.length).toBeGreaterThan(0);
        }
      });

      it("restricted entries do not overlap with bans", () => {
        const banSet = new Set(format.bans.map((b) => b.toLowerCase()));
        for (const restricted of format.restricted!) {
          expect(banSet.has(restricted.toLowerCase())).toBe(false);
        }
      });
    }
  });
});

// =============================================================================
// Specific format content checks
// =============================================================================

describe("specific format definitions", () => {
  it("gen9ou includes Species Clause in rules", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou")!;
    expect(ou.rules).toContain("Species Clause");
  });

  it("gen9ou includes Sleep Clause Mod in rules", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou")!;
    expect(ou.rules).toContain("Sleep Clause Mod");
  });

  it("gen9ou bans Koraidon and Miraidon", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou")!;
    expect(ou.bans).toContain("Koraidon");
    expect(ou.bans).toContain("Miraidon");
  });

  it("gen9ou bans problematic abilities", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou")!;
    expect(ou.bans).toContain("Arena Trap");
    expect(ou.bans).toContain("Moody");
    expect(ou.bans).toContain("Shadow Tag");
  });

  it("gen9ou is a singles format at level 100", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou")!;
    expect(ou.gameType).toBe("singles");
    expect(ou.maxLevel).toBe(100);
  });

  it("gen9lc has maxLevel and defaultLevel of 5", () => {
    const lc = FORMAT_DEFINITIONS.find((f) => f.id === "gen9lc")!;
    expect(lc.maxLevel).toBe(5);
    expect(lc.defaultLevel).toBe(5);
  });

  it("gen9lc includes Little Cup in rules", () => {
    const lc = FORMAT_DEFINITIONS.find((f) => f.id === "gen9lc")!;
    expect(lc.rules).toContain("Little Cup");
  });

  it("gen9vgc2025 is a doubles format", () => {
    const vgc = FORMAT_DEFINITIONS.find((f) => f.id === "gen9vgc2025")!;
    expect(vgc.gameType).toBe("doubles");
  });

  it("gen9vgc2025 has restricted Pokemon list", () => {
    const vgc = FORMAT_DEFINITIONS.find((f) => f.id === "gen9vgc2025")!;
    expect(vgc.restricted).toBeDefined();
    expect(vgc.restricted!).toContain("Koraidon");
    expect(vgc.restricted!).toContain("Miraidon");
  });

  it("gen9vgc2025 has Item Clause in rules", () => {
    const vgc = FORMAT_DEFINITIONS.find((f) => f.id === "gen9vgc2025")!;
    expect(vgc.rules).toContain("Item Clause");
  });

  it("gen9vgc2024 is inactive", () => {
    const vgc2024 = FORMAT_DEFINITIONS.find((f) => f.id === "gen9vgc2024")!;
    expect(vgc2024.isActive).toBe(false);
  });

  it("gen9vgc2025 is active", () => {
    const vgc2025 = FORMAT_DEFINITIONS.find((f) => f.id === "gen9vgc2025")!;
    expect(vgc2025.isActive).toBe(true);
  });

  it("gen9ubers has fewer bans than gen9ou", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou")!;
    const ubers = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ubers")!;
    expect(ubers.bans.length).toBeLessThan(ou.bans.length);
  });

  it("gen9nationaldex uses natdex scope", () => {
    const natdex = FORMAT_DEFINITIONS.find((f) => f.id === "gen9nationaldex")!;
    expect(natdex.dexScope).toBe("natdex");
  });

  it("gen9nationaldexuu uses natdex scope", () => {
    const natdexuu = FORMAT_DEFINITIONS.find((f) => f.id === "gen9nationaldexuu")!;
    expect(natdexuu.dexScope).toBe("natdex");
  });

  it("battle stadium formats use level 50", () => {
    const bss = FORMAT_DEFINITIONS.find((f) => f.id === "gen9battlestadiumsingles")!;
    const bsd = FORMAT_DEFINITIONS.find((f) => f.id === "gen9battlestadiumdoubles")!;
    expect(bss.maxLevel).toBe(50);
    expect(bss.defaultLevel).toBe(50);
    expect(bsd.maxLevel).toBe(50);
    expect(bsd.defaultLevel).toBe(50);
  });

  it("gen9monotype includes Same Type Clause", () => {
    const mono = FORMAT_DEFINITIONS.find((f) => f.id === "gen9monotype")!;
    expect(mono.rules).toContain("Same Type Clause");
  });

  it("all smogon singles tiers share standard rules", () => {
    const smogonSinglesIds = ["gen9ou", "gen9uu", "gen9ru", "gen9nu"];
    const standardRules = [
      "Species Clause",
      "Sleep Clause Mod",
      "Evasion Clause",
      "OHKO Clause",
      "Moody Clause",
      "Baton Pass Clause",
    ];
    for (const id of smogonSinglesIds) {
      const format = FORMAT_DEFINITIONS.find((f) => f.id === id)!;
      for (const rule of standardRules) {
        expect(format.rules).toContain(rule);
      }
    }
  });

  it("lower tiers ban higher tiers cumulatively", () => {
    const uu = FORMAT_DEFINITIONS.find((f) => f.id === "gen9uu")!;
    expect(uu.bans).toContain("OU");
    expect(uu.bans).toContain("UUBL");

    const ru = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ru")!;
    expect(ru.bans).toContain("OU");
    expect(ru.bans).toContain("UUBL");
    expect(ru.bans).toContain("UU");
    expect(ru.bans).toContain("RUBL");

    const nu = FORMAT_DEFINITIONS.find((f) => f.id === "gen9nu")!;
    expect(nu.bans).toContain("OU");
    expect(nu.bans).toContain("UUBL");
    expect(nu.bans).toContain("UU");
    expect(nu.bans).toContain("RUBL");
    expect(nu.bans).toContain("RU");
    expect(nu.bans).toContain("NUBL");
  });
});
