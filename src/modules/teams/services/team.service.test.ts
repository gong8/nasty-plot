import type { TeamCreateInput, TeamSlotInput } from "@/shared/types";

// ---------------------------------------------------------------------------
// Mock the Prisma client
// ---------------------------------------------------------------------------

vi.mock("@/shared/services/prisma", () => ({
  prisma: {
    format: { upsert: vi.fn() },
    team: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamSlot: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/shared/services/prisma";
import {
  createTeam,
  getTeam,
  listTeams,
  updateTeam,
  deleteTeam,
  addSlot,
  updateSlot,
  removeSlot,
  reorderSlots,
} from "./team.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockedPrisma = vi.mocked(prisma, true);

const NOW = new Date("2025-01-15T12:00:00Z");

function makeDbSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    teamId: "team-1",
    position: 1,
    pokemonId: "garchomp",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: "Fire",
    level: 100,
    move1: "Earthquake",
    move2: "Outrage",
    move3: "Swords Dance",
    move4: "Scale Shot",
    evHp: 4,
    evAtk: 252,
    evDef: 0,
    evSpA: 0,
    evSpD: 0,
    evSpe: 252,
    ivHp: 31,
    ivAtk: 31,
    ivDef: 31,
    ivSpA: 31,
    ivSpD: 31,
    ivSpe: 31,
    ...overrides,
  };
}

function makeDbTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    name: "My Team",
    formatId: "gen9ou",
    mode: "freeform",
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    slots: [makeDbSlot()],
    ...overrides,
  };
}

function makeSlotInput(overrides: Partial<TeamSlotInput> = {}): TeamSlotInput {
  return {
    position: 1,
    pokemonId: "garchomp",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    level: 100,
    teraType: "Fire",
    moves: ["Earthquake", "Outrage", "Swords Dance", "Scale Shot"],
    evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTeam", () => {
  it("upserts the format and creates a team via prisma", async () => {
    const dbTeam = makeDbTeam({ slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    const input: TeamCreateInput = { name: "My Team", formatId: "gen9ou" };
    const result = await createTeam(input);

    expect(mockedPrisma.format.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gen9ou" },
        create: expect.objectContaining({
          id: "gen9ou",
          generation: 9,
          gameType: "singles",
        }),
      })
    );
    expect(mockedPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My Team",
          formatId: "gen9ou",
          mode: "freeform",
          notes: null,
        }),
        include: { slots: true },
      })
    );
    expect(result.id).toBe("team-1");
    expect(result.name).toBe("My Team");
    expect(result.formatId).toBe("gen9ou");
    expect(result.mode).toBe("freeform");
    expect(result.slots).toEqual([]);
  });

  it("sets mode to 'freeform' by default when mode is not specified", async () => {
    const dbTeam = makeDbTeam({ slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    await createTeam({ name: "Test", formatId: "gen9ou" });

    expect(mockedPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "freeform" }),
      })
    );
  });

  it("uses the provided mode when specified", async () => {
    const dbTeam = makeDbTeam({ mode: "guided", slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    await createTeam({ name: "Test", formatId: "gen9ou", mode: "guided" });

    expect(mockedPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "guided" }),
      })
    );
  });

  it("detects doubles format for VGC format IDs", async () => {
    const dbTeam = makeDbTeam({ formatId: "gen9vgc2024", slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    await createTeam({ name: "VGC", formatId: "gen9vgc2024" });

    expect(mockedPrisma.format.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ gameType: "doubles" }),
      })
    );
  });

  it("detects doubles format for doubles format IDs", async () => {
    const dbTeam = makeDbTeam({ formatId: "gen9doublesou", slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    await createTeam({ name: "Doubles", formatId: "gen9doublesou" });

    expect(mockedPrisma.format.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ gameType: "doubles" }),
      })
    );
  });

  it("falls back to generation 9 when no digit is found in formatId", async () => {
    const dbTeam = makeDbTeam({ formatId: "ou", slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    await createTeam({ name: "Test", formatId: "ou" });

    // "ou" has no digits -> replace removes all chars -> charAt(0) is "" -> "||" fallback yields "9"
    expect(mockedPrisma.format.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ generation: 9 }),
      })
    );
  });

  it("maps DB team to domain with ISO date strings", async () => {
    const dbTeam = makeDbTeam({ slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    const result = await createTeam({ name: "Test", formatId: "gen9ou" });

    expect(result.createdAt).toBe(NOW.toISOString());
    expect(result.updatedAt).toBe(NOW.toISOString());
  });

  it("passes notes as null when not provided", async () => {
    const dbTeam = makeDbTeam({ slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    await createTeam({ name: "Test", formatId: "gen9ou" });

    expect(mockedPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: null }),
      })
    );
  });

  it("passes notes when provided", async () => {
    const dbTeam = makeDbTeam({ notes: "some notes", slots: [] });
    mockedPrisma.format.upsert.mockResolvedValue({} as never);
    mockedPrisma.team.create.mockResolvedValue(dbTeam as never);

    await createTeam({ name: "Test", formatId: "gen9ou", notes: "some notes" });

    expect(mockedPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: "some notes" }),
      })
    );
  });
});

describe("getTeam", () => {
  it("returns the domain-mapped team when found", async () => {
    const dbTeam = makeDbTeam();
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");

    expect(mockedPrisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: "team-1" },
      include: { slots: { orderBy: { position: "asc" } } },
    });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("team-1");
    expect(result!.slots).toHaveLength(1);
    expect(result!.slots[0].pokemonId).toBe("garchomp");
    expect(result!.slots[0].evs).toEqual({
      hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252,
    });
    expect(result!.slots[0].ivs).toEqual({
      hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31,
    });
  });

  it("returns null when the team is not found", async () => {
    mockedPrisma.team.findUnique.mockResolvedValue(null as never);

    const result = await getTeam("nonexistent");
    expect(result).toBeNull();
  });

  it("maps slot moves correctly, converting null to undefined", async () => {
    const dbTeam = makeDbTeam({
      slots: [makeDbSlot({ move2: null, move3: null, move4: null })],
    });
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");
    expect(result!.slots[0].moves).toEqual(["Earthquake", undefined, undefined, undefined]);
  });

  it("maps notes from null to undefined", async () => {
    const dbTeam = makeDbTeam({ notes: null });
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");
    expect(result!.notes).toBeUndefined();
  });

  it("maps notes when present", async () => {
    const dbTeam = makeDbTeam({ notes: "my notes" });
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");
    expect(result!.notes).toBe("my notes");
  });

  it("sorts slots by position", async () => {
    const dbTeam = makeDbTeam({
      slots: [
        makeDbSlot({ id: 2, position: 2, pokemonId: "tyranitar" }),
        makeDbSlot({ id: 1, position: 1, pokemonId: "garchomp" }),
      ],
    });
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");
    expect(result!.slots[0].pokemonId).toBe("garchomp");
    expect(result!.slots[1].pokemonId).toBe("tyranitar");
  });
});

describe("listTeams", () => {
  it("returns all teams when no filter is provided", async () => {
    const dbTeams = [makeDbTeam(), makeDbTeam({ id: "team-2", name: "Team 2" })];
    mockedPrisma.team.findMany.mockResolvedValue(dbTeams as never);

    const result = await listTeams();

    expect(mockedPrisma.team.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { slots: { orderBy: { position: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toHaveLength(2);
  });

  it("filters by formatId when provided", async () => {
    mockedPrisma.team.findMany.mockResolvedValue([] as never);

    await listTeams({ formatId: "gen9ou" });

    expect(mockedPrisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formatId: "gen9ou" },
      })
    );
  });

  it("returns empty array when no teams exist", async () => {
    mockedPrisma.team.findMany.mockResolvedValue([] as never);

    const result = await listTeams();
    expect(result).toEqual([]);
  });

  it("passes undefined as where when filters object has no formatId", async () => {
    mockedPrisma.team.findMany.mockResolvedValue([] as never);

    await listTeams({});

    expect(mockedPrisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      })
    );
  });
});

describe("updateTeam", () => {
  it("updates only the provided fields", async () => {
    const dbTeam = makeDbTeam({ name: "Updated Name" });
    mockedPrisma.team.update.mockResolvedValue(dbTeam as never);

    const result = await updateTeam("team-1", { name: "Updated Name" } as Partial<TeamCreateInput>);

    expect(mockedPrisma.team.update).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { name: "Updated Name" },
      include: { slots: { orderBy: { position: "asc" } } },
    });
    expect(result.name).toBe("Updated Name");
  });

  it("handles updating multiple fields at once", async () => {
    const dbTeam = makeDbTeam({ name: "New", formatId: "gen9uu", mode: "guided" });
    mockedPrisma.team.update.mockResolvedValue(dbTeam as never);

    await updateTeam("team-1", {
      name: "New",
      formatId: "gen9uu",
      mode: "guided",
    });

    expect(mockedPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "New", formatId: "gen9uu", mode: "guided" },
      })
    );
  });

  it("excludes notes from data when notes is undefined (not explicitly set)", async () => {
    const dbTeam = makeDbTeam();
    mockedPrisma.team.update.mockResolvedValue(dbTeam as never);

    // When notes is undefined, the `notes !== undefined` guard is false, so it's excluded
    await updateTeam("team-1", { notes: undefined } as Partial<TeamCreateInput>);

    expect(mockedPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} })
    );
  });

  it("converts explicit notes value to null via ?? operator", async () => {
    const dbTeam = makeDbTeam();
    mockedPrisma.team.update.mockResolvedValue(dbTeam as never);

    await updateTeam("team-1", { notes: "hello" });

    expect(mockedPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: "hello" }),
      })
    );
  });

  it("sends an empty data object when no fields are provided", async () => {
    const dbTeam = makeDbTeam();
    mockedPrisma.team.update.mockResolvedValue(dbTeam as never);

    await updateTeam("team-1", {});

    expect(mockedPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} })
    );
  });

  it("converts null notes to null via the ?? operator", async () => {
    const dbTeam = makeDbTeam();
    mockedPrisma.team.update.mockResolvedValue(dbTeam as never);

    // Force null through to exercise the ?? null branch on line 213
    await updateTeam("team-1", { notes: null } as unknown as Partial<TeamCreateInput>);

    expect(mockedPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: null }),
      })
    );
  });
});

describe("deleteTeam", () => {
  it("calls prisma.team.delete with the correct id", async () => {
    mockedPrisma.team.delete.mockResolvedValue({} as never);

    await deleteTeam("team-1");

    expect(mockedPrisma.team.delete).toHaveBeenCalledWith({ where: { id: "team-1" } });
  });

  it("does not return a value", async () => {
    mockedPrisma.team.delete.mockResolvedValue({} as never);
    const result = await deleteTeam("team-1");
    expect(result).toBeUndefined();
  });
});

describe("addSlot", () => {
  it("creates a new slot when the team has fewer than 6", async () => {
    mockedPrisma.teamSlot.count.mockResolvedValue(3 as never);
    const dbSlot = makeDbSlot();
    mockedPrisma.teamSlot.create.mockResolvedValue(dbSlot as never);

    const input = makeSlotInput();
    const result = await addSlot("team-1", input);

    expect(mockedPrisma.teamSlot.count).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
    expect(mockedPrisma.teamSlot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: "team-1",
        position: 1,
        pokemonId: "garchomp",
        ability: "Rough Skin",
        item: "Leftovers",
        nature: "Jolly",
        teraType: "Fire",
        level: 100,
        move1: "Earthquake",
        move2: "Outrage",
        move3: "Swords Dance",
        move4: "Scale Shot",
        evHp: 4,
        evAtk: 252,
        evDef: 0,
        evSpA: 0,
        evSpD: 0,
        evSpe: 252,
        ivHp: 31,
        ivAtk: 31,
        ivDef: 31,
        ivSpA: 31,
        ivSpD: 31,
        ivSpe: 31,
      }),
    });
    expect(result.pokemonId).toBe("garchomp");
  });

  it("throws when the team already has 6 slots", async () => {
    mockedPrisma.teamSlot.count.mockResolvedValue(6 as never);

    await expect(addSlot("team-1", makeSlotInput())).rejects.toThrow(
      "Team already has 6 slots"
    );
    expect(mockedPrisma.teamSlot.create).not.toHaveBeenCalled();
  });

  it("converts undefined teraType to null for DB", async () => {
    mockedPrisma.teamSlot.count.mockResolvedValue(0 as never);
    const dbSlot = makeDbSlot({ teraType: null });
    mockedPrisma.teamSlot.create.mockResolvedValue(dbSlot as never);

    const input = makeSlotInput({ teraType: undefined });
    await addSlot("team-1", input);

    expect(mockedPrisma.teamSlot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ teraType: null }),
    });
  });

  it("converts undefined moves to null for DB", async () => {
    mockedPrisma.teamSlot.count.mockResolvedValue(0 as never);
    const dbSlot = makeDbSlot({ move2: null, move3: null, move4: null });
    mockedPrisma.teamSlot.create.mockResolvedValue(dbSlot as never);

    const input = makeSlotInput({ moves: ["Earthquake"] });
    await addSlot("team-1", input);

    expect(mockedPrisma.teamSlot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        move1: "Earthquake",
        move2: null,
        move3: null,
        move4: null,
      }),
    });
  });

  it("returns domain-mapped slot data", async () => {
    mockedPrisma.teamSlot.count.mockResolvedValue(0 as never);
    const dbSlot = makeDbSlot({ teraType: "Water" });
    mockedPrisma.teamSlot.create.mockResolvedValue(dbSlot as never);

    const result = await addSlot("team-1", makeSlotInput({ teraType: "Water" }));

    expect(result.teraType).toBe("Water");
    expect(result.moves).toEqual(["Earthquake", "Outrage", "Swords Dance", "Scale Shot"]);
    expect(result.evs).toEqual({ hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 });
  });
});

describe("updateSlot", () => {
  it("updates only pokemonId when only pokemonId is provided", async () => {
    const dbSlot = makeDbSlot({ pokemonId: "tyranitar" });
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    await updateSlot("team-1", 1, { pokemonId: "tyranitar" });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { teamId_position: { teamId: "team-1", position: 1 } },
      data: { pokemonId: "tyranitar" },
    });
  });

  it("updates ability, item, nature, level, and teraType when all are provided", async () => {
    const dbSlot = makeDbSlot();
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    await updateSlot("team-1", 1, {
      ability: "Sand Veil",
      item: "Choice Scarf",
      nature: "Adamant",
      level: 50,
      teraType: "Steel",
    });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { teamId_position: { teamId: "team-1", position: 1 } },
      data: {
        ability: "Sand Veil",
        item: "Choice Scarf",
        nature: "Adamant",
        level: 50,
        teraType: "Steel",
      },
    });
  });

  it("maps moves array to move1-move4 fields", async () => {
    const dbSlot = makeDbSlot();
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    await updateSlot("team-1", 1, {
      moves: ["Flamethrower", "Ice Beam", undefined, undefined],
    });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          move1: "Flamethrower",
          move2: "Ice Beam",
          move3: null,
          move4: null,
        }),
      })
    );
  });

  it("maps evs to individual EV columns", async () => {
    const dbSlot = makeDbSlot();
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    await updateSlot("team-1", 1, {
      evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 },
    });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evHp: 252,
          evAtk: 0,
          evDef: 0,
          evSpA: 252,
          evSpD: 4,
          evSpe: 0,
        }),
      })
    );
  });

  it("maps ivs to individual IV columns", async () => {
    const dbSlot = makeDbSlot();
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    await updateSlot("team-1", 1, {
      ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
    });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ivHp: 31,
          ivAtk: 0,
          ivDef: 31,
          ivSpA: 31,
          ivSpD: 31,
          ivSpe: 31,
        }),
      })
    );
  });

  it("excludes teraType from data when it is undefined (guard check is false)", async () => {
    const dbSlot = makeDbSlot({ teraType: null });
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    // When teraType is undefined, `data.teraType !== undefined` is false, so nothing is added
    await updateSlot("team-1", 1, { teraType: undefined });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} })
    );
  });

  it("converts explicit null-ish teraType to null via ?? operator", async () => {
    const dbSlot = makeDbSlot({ teraType: null });
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    // When teraType is explicitly set to a value, the ?? null passes it through
    await updateSlot("team-1", 1, { teraType: "Fire" });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teraType: "Fire" }),
      })
    );
  });

  it("converts explicit null teraType to null via ?? null branch", async () => {
    const dbSlot = makeDbSlot({ teraType: null });
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    // Force null through to exercise the ?? null branch on line 251
    await updateSlot("team-1", 1, { teraType: null } as unknown as Partial<TeamSlotInput>);

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teraType: null }),
      })
    );
  });

  it("maps moves with empty first slot to empty string via || fallback", async () => {
    const dbSlot = makeDbSlot({ move1: "", move2: null, move3: null, move4: null });
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    // moves[0] is undefined/empty -> || "" fallback on line 255
    await updateSlot("team-1", 1, { moves: [undefined as unknown as string, "Outrage"] });

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          move1: "",
          move2: "Outrage",
          move3: null,
          move4: null,
        }),
      })
    );
  });

  it("sends empty data object when nothing is provided to update", async () => {
    const dbSlot = makeDbSlot();
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    await updateSlot("team-1", 1, {});

    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} })
    );
  });

  it("returns domain-mapped slot data", async () => {
    const dbSlot = makeDbSlot({ pokemonId: "tyranitar", teraType: null });
    mockedPrisma.teamSlot.update.mockResolvedValue(dbSlot as never);

    const result = await updateSlot("team-1", 1, { pokemonId: "tyranitar" });

    expect(result.pokemonId).toBe("tyranitar");
    expect(result.teraType).toBeNull();
  });
});

describe("removeSlot", () => {
  it("deletes the slot and reorders remaining slots", async () => {
    mockedPrisma.teamSlot.delete.mockResolvedValue({} as never);
    const remaining = [
      makeDbSlot({ id: 2, position: 3, pokemonId: "tyranitar" }),
      makeDbSlot({ id: 3, position: 4, pokemonId: "skarmory" }),
    ];
    mockedPrisma.teamSlot.findMany.mockResolvedValue(remaining as never);
    mockedPrisma.teamSlot.update.mockResolvedValue({} as never);

    await removeSlot("team-1", 2);

    expect(mockedPrisma.teamSlot.delete).toHaveBeenCalledWith({
      where: { teamId_position: { teamId: "team-1", position: 2 } },
    });
    expect(mockedPrisma.teamSlot.findMany).toHaveBeenCalledWith({
      where: { teamId: "team-1" },
      orderBy: { position: "asc" },
    });
    // Position 3 should become 1, position 4 should become 2
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { position: 1 },
    });
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { position: 2 },
    });
  });

  it("does not call update when remaining slots already have correct positions", async () => {
    mockedPrisma.teamSlot.delete.mockResolvedValue({} as never);
    const remaining = [
      makeDbSlot({ id: 1, position: 1, pokemonId: "garchomp" }),
    ];
    mockedPrisma.teamSlot.findMany.mockResolvedValue(remaining as never);

    await removeSlot("team-1", 2);

    // Position 1 already correct, no update needed
    expect(mockedPrisma.teamSlot.update).not.toHaveBeenCalled();
  });

  it("handles removing the only slot with no remaining slots", async () => {
    mockedPrisma.teamSlot.delete.mockResolvedValue({} as never);
    mockedPrisma.teamSlot.findMany.mockResolvedValue([] as never);

    await removeSlot("team-1", 1);

    expect(mockedPrisma.teamSlot.delete).toHaveBeenCalled();
    expect(mockedPrisma.teamSlot.update).not.toHaveBeenCalled();
  });
});

describe("reorderSlots", () => {
  it("reorders slots using temporary positions to avoid unique constraint conflicts", async () => {
    const slots = [
      makeDbSlot({ id: 10, position: 1, pokemonId: "garchomp" }),
      makeDbSlot({ id: 20, position: 2, pokemonId: "tyranitar" }),
      makeDbSlot({ id: 30, position: 3, pokemonId: "skarmory" }),
    ];
    mockedPrisma.teamSlot.findMany.mockResolvedValue(slots as never);
    mockedPrisma.teamSlot.update.mockResolvedValue({} as never);

    // Reverse order: [3, 2, 1]
    await reorderSlots("team-1", [3, 2, 1]);

    // Phase 1: move to temporary positions (100+)
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 10 }, data: { position: 100 },
    });
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 20 }, data: { position: 101 },
    });
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 30 }, data: { position: 102 },
    });

    // Phase 2: assign final positions
    // newOrder[0] = 3 -> posToId.get(3) = 30 -> position 1
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 30 }, data: { position: 1 },
    });
    // newOrder[1] = 2 -> posToId.get(2) = 20 -> position 2
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 20 }, data: { position: 2 },
    });
    // newOrder[2] = 1 -> posToId.get(1) = 10 -> position 3
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledWith({
      where: { id: 10 }, data: { position: 3 },
    });

    // Total: 3 temp + 3 final = 6 update calls
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledTimes(6);
  });

  it("handles identity reorder (same order)", async () => {
    const slots = [
      makeDbSlot({ id: 10, position: 1 }),
      makeDbSlot({ id: 20, position: 2 }),
    ];
    mockedPrisma.teamSlot.findMany.mockResolvedValue(slots as never);
    mockedPrisma.teamSlot.update.mockResolvedValue({} as never);

    await reorderSlots("team-1", [1, 2]);

    // 2 temp + 2 final = 4 calls even for identity reorder
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledTimes(4);
  });

  it("skips final assignment for positions not in newOrder", async () => {
    const slots = [
      makeDbSlot({ id: 10, position: 1 }),
      makeDbSlot({ id: 20, position: 2 }),
    ];
    mockedPrisma.teamSlot.findMany.mockResolvedValue(slots as never);
    mockedPrisma.teamSlot.update.mockResolvedValue({} as never);

    // newOrder references position 99 which does not exist
    await reorderSlots("team-1", [1, 99]);

    // 2 temp + 1 valid final (position 1 exists, 99 does not) = 3
    expect(mockedPrisma.teamSlot.update).toHaveBeenCalledTimes(3);
  });

  it("handles empty slots gracefully", async () => {
    mockedPrisma.teamSlot.findMany.mockResolvedValue([] as never);
    mockedPrisma.teamSlot.update.mockResolvedValue({} as never);

    await reorderSlots("team-1", []);

    expect(mockedPrisma.teamSlot.update).not.toHaveBeenCalled();
  });
});

describe("domain mapping edge cases", () => {
  it("maps teraType null to correct type in domain", async () => {
    const dbTeam = makeDbTeam({
      slots: [makeDbSlot({ teraType: null })],
    });
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");
    // The cast `as TeamSlotData["teraType"]` maps null to null
    expect(result!.slots[0].teraType).toBeNull();
  });

  it("maps all EV fields from DB columns to domain stats table", async () => {
    const dbTeam = makeDbTeam({
      slots: [makeDbSlot({
        evHp: 100,
        evAtk: 200,
        evDef: 50,
        evSpA: 60,
        evSpD: 70,
        evSpe: 30,
      })],
    });
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");
    expect(result!.slots[0].evs).toEqual({
      hp: 100, atk: 200, def: 50, spa: 60, spd: 70, spe: 30,
    });
  });

  it("maps all IV fields from DB columns to domain stats table", async () => {
    const dbTeam = makeDbTeam({
      slots: [makeDbSlot({
        ivHp: 0,
        ivAtk: 15,
        ivDef: 20,
        ivSpA: 25,
        ivSpD: 10,
        ivSpe: 5,
      })],
    });
    mockedPrisma.team.findUnique.mockResolvedValue(dbTeam as never);

    const result = await getTeam("team-1");
    expect(result!.slots[0].ivs).toEqual({
      hp: 0, atk: 15, def: 20, spa: 25, spd: 10, spe: 5,
    });
  });
});
