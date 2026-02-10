import { FORMAT_DEFINITIONS } from "@nasty-plot/formats";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FORMAT_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(FORMAT_DEFINITIONS)).toBe(true);
    expect(FORMAT_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("each format has required fields", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(format).toHaveProperty("id");
      expect(format).toHaveProperty("name");
      expect(format).toHaveProperty("generation");
      expect(format).toHaveProperty("gameType");
      expect(format).toHaveProperty("dexScope");
      expect(format).toHaveProperty("teamSize");
      expect(format).toHaveProperty("maxLevel");
      expect(format).toHaveProperty("defaultLevel");
      expect(format).toHaveProperty("rules");
      expect(format).toHaveProperty("bans");
      expect(format).toHaveProperty("isActive");
    }
  });

  it("each format has a unique id", () => {
    const ids = FORMAT_DEFINITIONS.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all formats have generation 9", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(format.generation).toBe(9);
    }
  });

  it("gameType is either singles or doubles", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(["singles", "doubles"]).toContain(format.gameType);
    }
  });

  it("teamSize is 6 for all formats", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(format.teamSize).toBe(6);
    }
  });

  it("rules is an array of strings", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(Array.isArray(format.rules)).toBe(true);
      for (const rule of format.rules) {
        expect(typeof rule).toBe("string");
      }
    }
  });

  it("bans is an array of strings", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(Array.isArray(format.bans)).toBe(true);
      for (const ban of format.bans) {
        expect(typeof ban).toBe("string");
      }
    }
  });

  it("maxLevel and defaultLevel are positive numbers", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(format.maxLevel).toBeGreaterThan(0);
      expect(format.defaultLevel).toBeGreaterThan(0);
      expect(format.defaultLevel).toBeLessThanOrEqual(format.maxLevel);
    }
  });

  it("contains gen9ou format", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou");
    expect(ou).toBeDefined();
    expect(ou!.name).toBe("OU");
    expect(ou!.isActive).toBe(true);
    expect(ou!.gameType).toBe("singles");
  });

  it("OU bans certain legendary Pokemon", () => {
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou");
    expect(ou).toBeDefined();
    expect(ou!.bans).toContain("Koraidon");
    expect(ou!.bans).toContain("Miraidon");
  });

  it("contains VGC formats", () => {
    const vgc = FORMAT_DEFINITIONS.filter((f) => f.id.includes("vgc"));
    expect(vgc.length).toBeGreaterThan(0);
    for (const format of vgc) {
      expect(format.gameType).toBe("doubles");
      expect(format.maxLevel).toBe(50);
    }
  });

  it("LC format has level 5", () => {
    const lc = FORMAT_DEFINITIONS.find((f) => f.id === "gen9lc");
    expect(lc).toBeDefined();
    expect(lc!.maxLevel).toBe(5);
    expect(lc!.defaultLevel).toBe(5);
  });

  it("Ubers format exists and has fewer bans than OU", () => {
    const ubers = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ubers");
    const ou = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou");
    expect(ubers).toBeDefined();
    expect(ou).toBeDefined();
    expect(ubers!.bans.length).toBeLessThan(ou!.bans.length);
  });

  it("dexScope is either sv or natdex", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(["sv", "natdex"]).toContain(format.dexScope);
    }
  });

  it("isActive is a boolean", () => {
    for (const format of FORMAT_DEFINITIONS) {
      expect(typeof format.isActive).toBe("boolean");
    }
  });

  it("all singles formats include Species Clause", () => {
    const singlesFormats = FORMAT_DEFINITIONS.filter(
      (f) => f.gameType === "singles"
    );
    for (const format of singlesFormats) {
      expect(format.rules).toContain("Species Clause");
    }
  });
});
