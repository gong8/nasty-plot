import type { TeamCreateInput, TeamSlotInput } from "@nasty-plot/core"
import {
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_LEVEL,
  MAX_SINGLE_EV,
  PERFECT_IV,
  TEAM_SIZE,
} from "@nasty-plot/core"
import {
  createTeam,
  getTeam,
  listTeams,
  updateTeam,
  deleteTeam,
  addSlot,
  updateSlot,
  removeSlot,
  clearSlots,
  reorderSlots,
} from "@nasty-plot/teams"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    format: { upsert: vi.fn() },
    team: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    teamSlot: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpecies: vi.fn(() => undefined),
}))

import { prisma } from "@nasty-plot/db"

const mockFormatUpsert = prisma.format.upsert as ReturnType<typeof vi.fn>
const mockTeamCreate = prisma.team.create as ReturnType<typeof vi.fn>
const mockTeamFindUnique = prisma.team.findUnique as ReturnType<typeof vi.fn>
const mockTeamFindMany = prisma.team.findMany as ReturnType<typeof vi.fn>
const mockTeamCount = prisma.team.count as ReturnType<typeof vi.fn>
const mockTeamUpdate = prisma.team.update as ReturnType<typeof vi.fn>
const mockTeamDelete = prisma.team.delete as ReturnType<typeof vi.fn>
const mockSlotCount = prisma.teamSlot.count as ReturnType<typeof vi.fn>
const mockSlotCreate = prisma.teamSlot.create as ReturnType<typeof vi.fn>
const mockSlotUpdate = prisma.teamSlot.update as ReturnType<typeof vi.fn>
const mockSlotDelete = prisma.teamSlot.delete as ReturnType<typeof vi.fn>
const mockSlotDeleteMany = prisma.teamSlot.deleteMany as ReturnType<typeof vi.fn>
const mockSlotFindMany = prisma.teamSlot.findMany as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbTeam(overrides?: Record<string, unknown>) {
  const now = new Date()
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    notes: null,
    parentId: null,
    branchName: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    slots: [],
    ...overrides,
  }
}

function makeDbSlot(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    teamId: "team-1",
    position: 1,
    pokemonId: "garchomp",
    nickname: null,
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: null,
    level: DEFAULT_LEVEL,
    move1: "Earthquake",
    move2: "Dragon Claw",
    move3: null,
    move4: null,
    evHp: 0,
    evAtk: MAX_SINGLE_EV,
    evDef: 0,
    evSpA: 0,
    evSpD: 4,
    evSpe: MAX_SINGLE_EV,
    ivHp: PERFECT_IV,
    ivAtk: PERFECT_IV,
    ivDef: PERFECT_IV,
    ivSpA: PERFECT_IV,
    ivSpD: PERFECT_IV,
    ivSpe: PERFECT_IV,
    ...overrides,
  }
}

function makeSlotInput(overrides?: Partial<TeamSlotInput>): TeamSlotInput {
  return {
    position: 1,
    pokemonId: "garchomp",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    level: DEFAULT_LEVEL,
    moves: ["Earthquake", "Dragon Claw", undefined, undefined],
    evs: { ...DEFAULT_EVS, atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV },
    ivs: DEFAULT_IVS,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a team with correct data", async () => {
    mockFormatUpsert.mockResolvedValue({})
    mockTeamCreate.mockResolvedValue(makeDbTeam())

    const input: TeamCreateInput = {
      name: "Test Team",
      formatId: "gen9ou",
    }

    const result = await createTeam(input)

    expect(result.id).toBe("team-1")
    expect(result.name).toBe("Test Team")
    expect(result.formatId).toBe("gen9ou")
    expect(result.mode).toBe("freeform")
  })

  it("upserts format before creating team", async () => {
    mockFormatUpsert.mockResolvedValue({})
    mockTeamCreate.mockResolvedValue(makeDbTeam())

    await createTeam({ name: "Test", formatId: "gen9ou" })

    expect(mockFormatUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gen9ou" },
      }),
    )
  })

  it("defaults mode to freeform", async () => {
    mockFormatUpsert.mockResolvedValue({})
    mockTeamCreate.mockResolvedValue(makeDbTeam())

    await createTeam({ name: "Test", formatId: "gen9ou" })

    expect(mockTeamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "freeform" }),
      }),
    )
  })

  it("uses provided mode", async () => {
    mockFormatUpsert.mockResolvedValue({})
    mockTeamCreate.mockResolvedValue(makeDbTeam({ mode: "guided" }))

    await createTeam({ name: "Test", formatId: "gen9ou", mode: "guided" })

    expect(mockTeamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "guided" }),
      }),
    )
  })
})

describe("getTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns team when found", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam({ slots: [makeDbSlot()] }))

    const result = await getTeam("team-1")

    expect(result).not.toBeNull()
    expect(result!.id).toBe("team-1")
    expect(result!.slots).toHaveLength(1)
  })

  it("returns null when not found", async () => {
    mockTeamFindUnique.mockResolvedValue(null)

    const result = await getTeam("nonexistent")

    expect(result).toBeNull()
  })

  it("maps slot data correctly", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam({ slots: [makeDbSlot()] }))

    const result = await getTeam("team-1")

    const slot = result!.slots[0]
    expect(slot.pokemonId).toBe("garchomp")
    expect(slot.ability).toBe("Rough Skin")
    expect(slot.nature).toBe("Jolly")
    expect(slot.moves[0]).toBe("Earthquake")
    expect(slot.evs.atk).toBe(252)
    expect(slot.ivs.hp).toBe(31)
  })

  it("sorts slots by position", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam({
        slots: [
          makeDbSlot({ id: 3, position: 3, pokemonId: "heatran" }),
          makeDbSlot({ id: 1, position: 1, pokemonId: "garchomp" }),
          makeDbSlot({ id: 2, position: 2, pokemonId: "landorus" }),
        ],
      }),
    )

    const result = await getTeam("team-1")

    expect(result!.slots[0].pokemonId).toBe("garchomp")
    expect(result!.slots[1].pokemonId).toBe("landorus")
    expect(result!.slots[2].pokemonId).toBe("heatran")
  })
})

describe("listTeams", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists all teams without filters", async () => {
    mockTeamFindMany.mockResolvedValue([makeDbTeam()])
    mockTeamCount.mockResolvedValue(1)

    const result = await listTeams()

    expect(result.teams).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(mockTeamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isArchived: false },
        skip: 0,
        take: 20,
      }),
    )
  })

  it("filters by formatId", async () => {
    mockTeamFindMany.mockResolvedValue([])
    mockTeamCount.mockResolvedValue(0)

    await listTeams({ formatId: "gen9ou" })

    expect(mockTeamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formatId: "gen9ou", isArchived: false },
      }),
    )
  })
})

describe("updateTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates team fields", async () => {
    mockTeamUpdate.mockResolvedValue(makeDbTeam({ name: "New Name" }))

    const result = await updateTeam("team-1", { name: "New Name" })

    expect(result.name).toBe("New Name")
    expect(mockTeamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-1" },
      }),
    )
  })

  it("updates formatId, mode, and notes", async () => {
    mockTeamUpdate.mockResolvedValue(
      makeDbTeam({ formatId: "gen9uu", mode: "guided", notes: "test notes" }),
    )

    const result = await updateTeam("team-1", {
      name: "Test",
      formatId: "gen9uu",
      mode: "guided",
      notes: "test notes",
    })

    expect(result.formatId).toBe("gen9uu")
    expect(result.mode).toBe("guided")
    expect(mockTeamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formatId: "gen9uu",
          mode: "guided",
          notes: "test notes",
        }),
      }),
    )
  })

  it("skips undefined fields in update data", async () => {
    mockTeamUpdate.mockResolvedValue(makeDbTeam())

    await updateTeam("team-1", {})

    expect(mockTeamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {},
      }),
    )
  })
})

describe("deleteTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes team by id", async () => {
    mockTeamFindUnique.mockResolvedValue({ parentId: null })
    ;(prisma.team.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    mockTeamDelete.mockResolvedValue({})

    await deleteTeam("team-1")

    expect(mockTeamDelete).toHaveBeenCalledWith({ where: { id: "team-1" } })
  })
})

describe("addSlot", () => {
  beforeEach(() => vi.clearAllMocks())

  it("adds a slot to a team", async () => {
    mockSlotCount.mockResolvedValue(0)
    mockSlotCreate.mockResolvedValue(makeDbSlot())

    const result = await addSlot("team-1", makeSlotInput())

    expect(result.pokemonId).toBe("garchomp")
    expect(mockSlotCreate).toHaveBeenCalled()
  })

  it("throws when team already has 6 slots", async () => {
    mockSlotCount.mockResolvedValue(TEAM_SIZE)

    await expect(addSlot("team-1", makeSlotInput())).rejects.toThrow("Team already has 6 slots")
  })
})

describe("updateSlot", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates slot data", async () => {
    mockSlotUpdate.mockResolvedValue(makeDbSlot({ pokemonId: "heatran" }))

    const result = await updateSlot("team-1", 1, { pokemonId: "heatran" })

    expect(result.pokemonId).toBe("heatran")
  })

  it("updates all scalar fields", async () => {
    mockSlotUpdate.mockResolvedValue(
      makeDbSlot({
        pokemonId: "heatran",
        nickname: "Hotboy",
        ability: "Flash Fire",
        item: "Air Balloon",
        nature: "Timid",
        teraType: "Grass",
        level: 50,
      }),
    )

    const result = await updateSlot("team-1", 1, {
      pokemonId: "heatran",
      nickname: "Hotboy",
      ability: "Flash Fire",
      item: "Air Balloon",
      nature: "Timid",
      teraType: "Grass",
      level: 50,
    })

    expect(result.pokemonId).toBe("heatran")
    expect(mockSlotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pokemonId: "heatran",
          nickname: "Hotboy",
          ability: "Flash Fire",
          item: "Air Balloon",
          nature: "Timid",
          teraType: "Grass",
          level: 50,
        }),
      }),
    )
  })

  it("updates moves, evs, and ivs", async () => {
    const evs = { hp: MAX_SINGLE_EV, atk: 0, def: 0, spa: MAX_SINGLE_EV, spd: 4, spe: 0 }
    const ivs = {
      hp: PERFECT_IV,
      atk: 0,
      def: PERFECT_IV,
      spa: PERFECT_IV,
      spd: PERFECT_IV,
      spe: PERFECT_IV,
    }
    mockSlotUpdate.mockResolvedValue(
      makeDbSlot({
        move1: "Magma Storm",
        move2: "Earth Power",
        move3: "Taunt",
        move4: "Stealth Rock",
        evHp: MAX_SINGLE_EV,
        evAtk: 0,
        evDef: 0,
        evSpA: MAX_SINGLE_EV,
        evSpD: 4,
        evSpe: 0,
        ivHp: PERFECT_IV,
        ivAtk: 0,
        ivDef: PERFECT_IV,
        ivSpA: PERFECT_IV,
        ivSpD: PERFECT_IV,
        ivSpe: PERFECT_IV,
      }),
    )

    await updateSlot("team-1", 1, {
      moves: ["Magma Storm", "Earth Power", "Taunt", "Stealth Rock"],
      evs,
      ivs,
    })

    expect(mockSlotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          move1: "Magma Storm",
          move2: "Earth Power",
          move3: "Taunt",
          move4: "Stealth Rock",
          evHp: MAX_SINGLE_EV,
          ivAtk: 0,
        }),
      }),
    )
  })

  it("only includes defined fields in update data", async () => {
    mockSlotUpdate.mockResolvedValue(makeDbSlot())

    await updateSlot("team-1", 1, {})

    expect(mockSlotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {},
      }),
    )
  })
})

describe("removeSlot", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes slot and reorders remaining", async () => {
    mockSlotDelete.mockResolvedValue({})
    mockSlotFindMany.mockResolvedValue([makeDbSlot({ id: 2, position: 3 })])
    mockSlotUpdate.mockResolvedValue({})

    await removeSlot("team-1", 2)

    expect(mockSlotDelete).toHaveBeenCalledWith({
      where: { teamId_position: { teamId: "team-1", position: 2 } },
    })
  })
})

describe("clearSlots", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes all slots for a team", async () => {
    mockSlotDeleteMany.mockResolvedValue({ count: 3 })

    await clearSlots("team-1")

    expect(mockSlotDeleteMany).toHaveBeenCalledWith({
      where: { teamId: "team-1" },
    })
  })
})

describe("reorderSlots", () => {
  beforeEach(() => vi.clearAllMocks())

  it("reorders slots to new positions", async () => {
    mockSlotFindMany.mockResolvedValue([
      makeDbSlot({ id: 1, position: 1 }),
      makeDbSlot({ id: 2, position: 2 }),
      makeDbSlot({ id: 3, position: 3 }),
    ])
    mockSlotUpdate.mockResolvedValue({})

    await reorderSlots("team-1", [3, 1, 2])

    // Should be called for temp positions + final positions
    expect(mockSlotUpdate).toHaveBeenCalled()
  })
})
