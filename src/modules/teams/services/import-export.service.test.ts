import type { TeamData, TeamSlotData, StatsTable } from "@/shared/types";
import {
  parseShowdownPaste,
  serializeShowdownPaste,
} from "@/shared/lib/showdown-paste";

// ---------------------------------------------------------------------------
// Mock the team.service module that import-export.service depends on
// ---------------------------------------------------------------------------

const mockCreateTeam = vi.fn();
const mockAddSlot = vi.fn();
const mockGetTeam = vi.fn();

vi.mock("./team.service", () => ({
  createTeam: (...args: unknown[]) => mockCreateTeam(...args),
  addSlot: (...args: unknown[]) => mockAddSlot(...args),
  getTeam: (...args: unknown[]) => mockGetTeam(...args),
}));

import { importShowdownPaste, exportShowdownPaste } from "./import-export.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvs(overrides: Partial<StatsTable> = {}): StatsTable {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...overrides };
}

function makeIvs(overrides: Partial<StatsTable> = {}): StatsTable {
  return { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...overrides };
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

function makeTeamData(slots: TeamSlotData[] = []): TeamData {
  return {
    id: "team-123",
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("importShowdownPaste", () => {
  describe("single Pokemon paste", () => {
    const SINGLE_PASTE = `Garchomp @ Leftovers
Ability: Rough Skin
Level: 100
Tera Type: Fire
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Earthquake
- Outrage
- Swords Dance
- Scale Shot`;

    it("creates a team and adds a slot for a single-Pokemon paste", async () => {
      const createdTeam = makeTeamData();
      const resultTeam = makeTeamData([makeSlot()]);

      mockCreateTeam.mockResolvedValue(createdTeam);
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(resultTeam);

      const result = await importShowdownPaste(SINGLE_PASTE, "gen9ou", "My Team");

      expect(mockCreateTeam).toHaveBeenCalledWith({
        name: "My Team",
        formatId: "gen9ou",
      });
      expect(mockAddSlot).toHaveBeenCalledTimes(1);
      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({
          position: 1,
          pokemonId: "garchomp",
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          level: 100,
          evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
        })
      );
      expect(mockGetTeam).toHaveBeenCalledWith("team-123");
      expect(result).toEqual(resultTeam);
    });

    it("uses 'Imported Team' as the default name when none is provided", async () => {
      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(SINGLE_PASTE, "gen9ou");

      expect(mockCreateTeam).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Imported Team" })
      );
    });
  });

  describe("multi-Pokemon paste", () => {
    const MULTI_PASTE = `Garchomp @ Leftovers
Ability: Rough Skin
EVs: 252 Atk / 252 Spe
Jolly Nature
- Earthquake
- Outrage

Tyranitar @ Choice Band
Ability: Sand Stream
EVs: 252 Atk / 252 HP
Adamant Nature
- Stone Edge
- Crunch
- Ice Punch
- Earthquake`;

    it("adds one slot per Pokemon block", async () => {
      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(MULTI_PASTE, "gen9ou");

      expect(mockAddSlot).toHaveBeenCalledTimes(2);
      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({ position: 1, pokemonId: "garchomp" })
      );
      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({ position: 2, pokemonId: "tyranitar" })
      );
    });
  });

  describe("paste with nickname and gender", () => {
    const NICKNAMED_PASTE = `Chomper (Garchomp) (M) @ Leftovers
Ability: Rough Skin
Jolly Nature
- Earthquake`;

    it("extracts the species pokemonId from parentheses, ignoring the nickname", async () => {
      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(NICKNAMED_PASTE, "gen9ou");

      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({ pokemonId: "garchomp" })
      );
    });
  });

  describe("paste with no item", () => {
    const NO_ITEM_PASTE = `Garchomp
Ability: Rough Skin
Jolly Nature
- Earthquake`;

    it("sets item to empty string when no item is specified", async () => {
      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(NO_ITEM_PASTE, "gen9ou");

      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({ item: "" })
      );
    });
  });

  describe("paste with custom IVs", () => {
    const IV_PASTE = `Garchomp @ Leftovers
Ability: Rough Skin
EVs: 252 SpA / 252 Spe
IVs: 0 Atk
Timid Nature
- Draco Meteor`;

    it("parses custom IVs and uses 31 for unmentioned stats", async () => {
      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(IV_PASTE, "gen9ou");

      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({
          ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
        })
      );
    });
  });

  describe("paste with tera type and level", () => {
    const TERA_LEVEL_PASTE = `Garchomp @ Leftovers
Ability: Rough Skin
Level: 50
Tera Type: Water
Jolly Nature
- Earthquake`;

    it("parses level and tera type correctly", async () => {
      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(TERA_LEVEL_PASTE, "gen9ou");

      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({
          level: 50,
          teraType: "Water",
        })
      );
    });
  });

  describe("default values for missing fields", () => {
    const MINIMAL_PASTE = `Garchomp
- Earthquake`;

    it("uses Hardy nature, level 100, default EVs/IVs for minimal paste", async () => {
      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(MINIMAL_PASTE, "gen9ou");

      expect(mockAddSlot).toHaveBeenCalledWith(
        "team-123",
        expect.objectContaining({
          nature: "Hardy",
          level: 100,
          ability: "",
          item: "",
          evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        })
      );
    });
  });

  describe("caps at 6 Pokemon", () => {
    it("only adds 6 slots even if the paste has more than 6 blocks", async () => {
      const blocks = Array.from({ length: 8 }, (_, i) =>
        `Pokemon${i + 1}\n- Move${i + 1}`
      ).join("\n\n");

      mockCreateTeam.mockResolvedValue(makeTeamData());
      mockAddSlot.mockResolvedValue(makeSlot());
      mockGetTeam.mockResolvedValue(makeTeamData());

      await importShowdownPaste(blocks, "gen9ou");

      expect(mockAddSlot).toHaveBeenCalledTimes(6);
    });
  });

  describe("error handling", () => {
    it("throws when the paste is empty", async () => {
      await expect(importShowdownPaste("", "gen9ou")).rejects.toThrow(
        "No valid Pokemon found in paste"
      );
      expect(mockCreateTeam).not.toHaveBeenCalled();
    });

    it("throws when the paste is only whitespace", async () => {
      await expect(importShowdownPaste("   \n  \n  ", "gen9ou")).rejects.toThrow(
        "No valid Pokemon found in paste"
      );
    });
  });
});

describe("exportShowdownPaste", () => {
  describe("basic export", () => {
    it("serializes a team into Showdown paste format", async () => {
      const slots: TeamSlotData[] = [
        makeSlot({
          position: 1,
          pokemonId: "garchomp",
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          level: 100,
          evs: makeEvs({ atk: 252, spe: 252, hp: 4 }),
          ivs: makeIvs(),
          moves: ["Earthquake", "Outrage", "Swords Dance", "Scale Shot"],
        }),
      ];
      const teamData = makeTeamData(slots);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");

      // The paste should contain the Pokemon name, item, ability, nature, etc.
      expect(result).toContain("garchomp @ Leftovers");
      expect(result).toContain("Ability: Rough Skin");
      expect(result).toContain("Jolly Nature");
      expect(result).toContain("- Earthquake");
      expect(result).toContain("- Outrage");
      expect(result).toContain("- Swords Dance");
      expect(result).toContain("- Scale Shot");
      expect(result).toContain("252 Atk");
      expect(result).toContain("252 Spe");
      expect(result).toContain("4 HP");
    });

    it("does not include Level line when level is 100", async () => {
      const teamData = makeTeamData([makeSlot({ level: 100 })]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).not.toContain("Level:");
    });

    it("includes Level line when level is not 100", async () => {
      const teamData = makeTeamData([makeSlot({ level: 50 })]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).toContain("Level: 50");
    });

    it("includes Tera Type when set", async () => {
      const teamData = makeTeamData([makeSlot({ teraType: "Fire" })]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).toContain("Tera Type: Fire");
    });

    it("does not include IVs line when all IVs are 31", async () => {
      const teamData = makeTeamData([makeSlot({ ivs: makeIvs() })]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).not.toContain("IVs:");
    });

    it("includes IVs line when IVs differ from default", async () => {
      const teamData = makeTeamData([makeSlot({ ivs: makeIvs({ atk: 0 }) })]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).toContain("IVs: 0 Atk");
    });

    it("does not include EVs line when all EVs are 0", async () => {
      const teamData = makeTeamData([makeSlot({ evs: makeEvs() })]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).not.toContain("EVs:");
    });

    it("does not include the item suffix when item is empty", async () => {
      const teamData = makeTeamData([makeSlot({ item: "" })]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      const firstLine = result.split("\n")[0];
      expect(firstLine).not.toContain("@");
    });

    it("uses species name if available instead of pokemonId", async () => {
      const slot = makeSlot({
        pokemonId: "garchomp",
        species: {
          id: "garchomp",
          name: "Garchomp",
          num: 445,
          types: ["Dragon", "Ground"],
          baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
          abilities: { "0": "Sand Veil" },
          weightkg: 95,
        },
      });
      const teamData = makeTeamData([slot]);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).toContain("Garchomp @ Leftovers");
    });
  });

  describe("multi-slot export", () => {
    it("separates Pokemon blocks with double newlines", async () => {
      const slots = [
        makeSlot({ position: 1, pokemonId: "garchomp", item: "Leftovers" }),
        makeSlot({ position: 2, pokemonId: "tyranitar", item: "Choice Band" }),
      ];
      const teamData = makeTeamData(slots);
      mockGetTeam.mockResolvedValue(teamData);

      const result = await exportShowdownPaste("team-123");
      expect(result).toContain("\n\n");
      const blocks = result.split("\n\n");
      expect(blocks).toHaveLength(2);
    });
  });

  describe("error handling", () => {
    it("throws when the team is not found", async () => {
      mockGetTeam.mockResolvedValue(null);

      await expect(exportShowdownPaste("nonexistent")).rejects.toThrow(
        "Team not found"
      );
    });
  });
});

describe("import-export round-trip", () => {
  it("a standard paste parsed then serialized produces functionally equivalent output", () => {
    // This tests the underlying parse/serialize logic directly
    // (since import/export go through team service mocks, this validates the showdown-paste lib)
    const paste = `Garchomp @ Leftovers
Ability: Rough Skin
Level: 50
Tera Type: Fire
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
IVs: 0 SpA
- Earthquake
- Outrage
- Swords Dance
- Scale Shot`;

    const parsed = parseShowdownPaste(paste);
    expect(parsed).toHaveLength(1);

    // Provide required fields to make it a valid TeamSlotData for serialization
    const slotData: TeamSlotData = {
      position: parsed[0].position,
      pokemonId: parsed[0].pokemonId,
      ability: parsed[0].ability,
      item: parsed[0].item,
      nature: parsed[0].nature,
      teraType: parsed[0].teraType,
      level: parsed[0].level,
      moves: parsed[0].moves,
      evs: parsed[0].evs,
      ivs: parsed[0].ivs,
    } as TeamSlotData;

    const serialized = serializeShowdownPaste([slotData]);

    expect(serialized).toContain("garchomp @ Leftovers");
    expect(serialized).toContain("Ability: Rough Skin");
    expect(serialized).toContain("Level: 50");
    expect(serialized).toContain("Tera Type: Fire");
    expect(serialized).toContain("252 Atk");
    expect(serialized).toContain("4 SpD");
    expect(serialized).toContain("252 Spe");
    expect(serialized).toContain("Jolly Nature");
    expect(serialized).toContain("IVs: 0 SpA");
    expect(serialized).toContain("- Earthquake");
    expect(serialized).toContain("- Outrage");
    expect(serialized).toContain("- Swords Dance");
    expect(serialized).toContain("- Scale Shot");
  });
});
