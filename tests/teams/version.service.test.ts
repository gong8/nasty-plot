import type {
  TeamData,
  TeamSlotData,
  NatureName,
  ForkOptions,
  MergeDecision,
} from "@nasty-plot/core"
import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL } from "@nasty-plot/core"
import {
  compareTeams,
  forkTeam,
  mergeTeams,
  getLineageTree,
  getTeamHistory,
  archiveTeam,
  restoreTeam,
} from "@nasty-plot/teams"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    format: { upsert: vi.fn() },
    team: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
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
    $transaction: vi.fn(),
  },
}))

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpecies: vi.fn(() => undefined),
}))

import { prisma } from "@nasty-plot/db"

const mockTeamFindUnique = prisma.team.findUnique as ReturnType<typeof vi.fn>
const mockTeamFindMany = prisma.team.findMany as ReturnType<typeof vi.fn>
const mockTeamUpdate = prisma.team.update as ReturnType<typeof vi.fn>
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlotData(overrides?: Partial<TeamSlotData>): TeamSlotData {
  return {
    position: 1,
    pokemonId: "garchomp",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly" as NatureName,
    level: DEFAULT_LEVEL,
    moves: ["Earthquake", "Dragon Claw", undefined, undefined],
    evs: { ...DEFAULT_EVS, atk: 252, spe: 252 },
    ivs: DEFAULT_IVS,
    ...overrides,
  }
}

function makeTeamData(overrides?: Partial<TeamData>): TeamData {
  return {
    id: "team-a",
    name: "Team A",
    formatId: "gen9ou",
    mode: "freeform",
    slots: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

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
  }
}

// ---------------------------------------------------------------------------
// Tests — compareTeams (pure function, no mocks needed)
// ---------------------------------------------------------------------------

describe("compareTeams", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns empty diff for identical teams", () => {
    const slot = makeSlotData()
    const teamA = makeTeamData({ id: "team-a", name: "Team A", slots: [slot] })
    const teamB = makeTeamData({ id: "team-b", name: "Team B", slots: [{ ...slot }] })

    const diff = compareTeams(teamA, teamB)

    expect(diff.changed).toHaveLength(0)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.unchanged).toEqual(["garchomp"])
    expect(diff.summary).toEqual({
      totalChanges: 0,
      slotsAdded: 0,
      slotsRemoved: 0,
      slotsChanged: 0,
      slotsUnchanged: 1,
    })
  })

  it("detects completely different teams", () => {
    const teamA = makeTeamData({
      id: "team-a",
      slots: [makeSlotData({ pokemonId: "garchomp" })],
    })
    const teamB = makeTeamData({
      id: "team-b",
      slots: [
        makeSlotData({
          position: 1,
          pokemonId: "heatran",
          ability: "Flash Fire",
          item: "Air Balloon",
          nature: "Timid" as NatureName,
          moves: ["Magma Storm", "Earth Power", undefined, undefined],
          evs: { ...DEFAULT_EVS, spa: 252, spe: 252 },
        }),
      ],
    })

    const diff = compareTeams(teamA, teamB)

    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0].pokemonId).toBe("garchomp")
    expect(diff.added).toHaveLength(1)
    expect(diff.added[0].pokemonId).toBe("heatran")
    expect(diff.changed).toHaveLength(0)
    expect(diff.unchanged).toHaveLength(0)
    expect(diff.summary).toEqual(
      expect.objectContaining({
        totalChanges: 2,
        slotsAdded: 1,
        slotsRemoved: 1,
      }),
    )
  })

  it("detects single field change (item swap)", () => {
    const slotA = makeSlotData()
    const slotB = makeSlotData({ item: "Choice Scarf" })
    const teamA = makeTeamData({ id: "team-a", slots: [slotA] })
    const teamB = makeTeamData({ id: "team-b", slots: [slotB] })

    const diff = compareTeams(teamA, teamB)

    expect(diff.changed).toHaveLength(1)
    expect(diff.changed[0].pokemonId).toBe("garchomp")
    expect(diff.changed[0].changes).toHaveLength(1)
    expect(diff.changed[0].changes[0]).toEqual({
      field: "item",
      label: "Item",
      before: "Leftovers",
      after: "Choice Scarf",
    })
  })

  it("detects EV spread changes", () => {
    const slotA = makeSlotData({
      evs: { ...DEFAULT_EVS, atk: 252, spe: 252 },
    })
    const slotB = makeSlotData({
      evs: { ...DEFAULT_EVS, hp: 252, def: 252 },
    })
    const teamA = makeTeamData({ id: "team-a", slots: [slotA] })
    const teamB = makeTeamData({ id: "team-b", slots: [slotB] })

    const diff = compareTeams(teamA, teamB)

    expect(diff.changed).toHaveLength(1)
    const evChanges = diff.changed[0].changes.filter((c) => c.field.startsWith("evs."))
    // hp: 0->252, atk: 252->0, def: 0->252, spe: 252->0
    expect(evChanges).toHaveLength(4)

    const fieldMap = Object.fromEntries(evChanges.map((c) => [c.field, c]))
    expect(fieldMap["evs.hp"]).toEqual(expect.objectContaining({ before: 0, after: 252 }))
    expect(fieldMap["evs.atk"]).toEqual(expect.objectContaining({ before: 252, after: 0 }))
    expect(fieldMap["evs.def"]).toEqual(expect.objectContaining({ before: 0, after: 252 }))
    expect(fieldMap["evs.spe"]).toEqual(expect.objectContaining({ before: 252, after: 0 }))
  })

  it("detects move changes per index", () => {
    const slotA = makeSlotData({
      moves: ["Earthquake", "Dragon Claw", undefined, undefined],
    })
    const slotB = makeSlotData({
      moves: ["Earthquake", "Stone Edge", "Swords Dance", undefined],
    })
    const teamA = makeTeamData({ id: "team-a", slots: [slotA] })
    const teamB = makeTeamData({ id: "team-b", slots: [slotB] })

    const diff = compareTeams(teamA, teamB)

    expect(diff.changed).toHaveLength(1)
    const moveChanges = diff.changed[0].changes.filter((c) => c.field.startsWith("moves["))
    expect(moveChanges).toHaveLength(2)

    const move1Change = moveChanges.find((c) => c.field === "moves[1]")
    expect(move1Change).toEqual({
      field: "moves[1]",
      label: "Move 2",
      before: "Dragon Claw",
      after: "Stone Edge",
    })

    const move2Change = moveChanges.find((c) => c.field === "moves[2]")
    expect(move2Change).toEqual({
      field: "moves[2]",
      label: "Move 3",
      before: undefined,
      after: "Swords Dance",
    })
  })

  it("detects Pokemon added/removed", () => {
    const teamA = makeTeamData({
      id: "team-a",
      slots: [
        makeSlotData({ position: 1, pokemonId: "garchomp" }),
        makeSlotData({
          position: 2,
          pokemonId: "heatran",
          ability: "Flash Fire",
          item: "Air Balloon",
          nature: "Timid" as NatureName,
        }),
      ],
    })
    const teamB = makeTeamData({
      id: "team-b",
      slots: [
        makeSlotData({ position: 1, pokemonId: "garchomp" }),
        makeSlotData({
          position: 2,
          pokemonId: "landorus",
          ability: "Intimidate",
          item: "Choice Scarf",
          nature: "Jolly" as NatureName,
        }),
      ],
    })

    const diff = compareTeams(teamA, teamB)

    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0].pokemonId).toBe("heatran")
    expect(diff.added).toHaveLength(1)
    expect(diff.added[0].pokemonId).toBe("landorus")
    // garchomp is identical — should be unchanged
    expect(diff.unchanged).toContain("garchomp")
  })

  it("handles duplicate pokemonId (position-based fallback)", () => {
    const teamA = makeTeamData({
      id: "team-a",
      slots: [
        makeSlotData({ position: 1, pokemonId: "garchomp", item: "Leftovers" }),
        makeSlotData({ position: 2, pokemonId: "garchomp", item: "Choice Scarf" }),
      ],
    })
    const teamB = makeTeamData({
      id: "team-b",
      slots: [
        makeSlotData({ position: 1, pokemonId: "garchomp", item: "Leftovers" }),
        makeSlotData({ position: 2, pokemonId: "garchomp", item: "Rocky Helmet" }),
      ],
    })

    const diff = compareTeams(teamA, teamB)

    // First garchomp pair is identical
    expect(diff.unchanged).toContain("garchomp")
    // Second garchomp pair has an item change
    expect(diff.changed).toHaveLength(1)
    expect(diff.changed[0].pokemonId).toBe("garchomp")
    const itemChange = diff.changed[0].changes.find((c) => c.field === "item")
    expect(itemChange).toEqual({
      field: "item",
      label: "Item",
      before: "Choice Scarf",
      after: "Rocky Helmet",
    })
  })

  it("handles null fields (teraType set vs unset)", () => {
    const slotA = makeSlotData({ teraType: undefined })
    const slotB = makeSlotData({ teraType: "Fire" })
    const teamA = makeTeamData({ id: "team-a", slots: [slotA] })
    const teamB = makeTeamData({ id: "team-b", slots: [slotB] })

    const diff = compareTeams(teamA, teamB)

    expect(diff.changed).toHaveLength(1)
    const teraChange = diff.changed[0].changes.find((c) => c.field === "teraType")
    expect(teraChange).toEqual({
      field: "teraType",
      label: "Tera Type",
      before: undefined,
      after: "Fire",
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — forkTeam (integration with mocked Prisma)
// ---------------------------------------------------------------------------

describe("forkTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  function setupForkMocks(
    sourceDbTeam: ReturnType<typeof makeDbTeam>,
    forkedDbTeam: ReturnType<typeof makeDbTeam>,
  ) {
    // getTeam (called inside forkTeam) uses prisma.team.findUnique
    mockTeamFindUnique.mockResolvedValue(sourceDbTeam)

    // $transaction receives a callback; provide tx stubs
    const txTeamCreate = vi.fn().mockResolvedValue({ id: forkedDbTeam.id })
    const txSlotCreate = vi.fn().mockResolvedValue({})
    const txTeamFindUnique = vi.fn().mockResolvedValue(forkedDbTeam)

    mockTransaction.mockImplementation(
      async (cb: (prisma: Record<string, Record<string, unknown>>) => Promise<unknown>) => {
        return cb({
          team: { create: txTeamCreate, findUnique: txTeamFindUnique },
          teamSlot: { create: txSlotCreate },
        })
      },
    )

    return { txTeamCreate, txSlotCreate, txTeamFindUnique }
  }

  it("creates a forked team with correct parentId", async () => {
    const sourceSlot = makeDbSlot({ teamId: "source-1" })
    const sourceDb = makeDbTeam({
      id: "source-1",
      name: "Source Team",
      slots: [sourceSlot],
    })
    const forkedDb = makeDbTeam({
      id: "fork-1",
      name: "Source Team (fork)",
      parentId: "source-1",
      slots: [makeDbSlot({ teamId: "fork-1" })],
    })

    const { txTeamCreate } = setupForkMocks(sourceDb, forkedDb)

    const result = await forkTeam("source-1")

    expect(txTeamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: "source-1",
          name: "Source Team (fork)",
        }),
      }),
    )
    expect(result.id).toBe("fork-1")
    expect(result.parentId).toBe("source-1")
  })

  it("copies all slots to the forked team", async () => {
    const sourceSlots = [
      makeDbSlot({ id: 1, position: 1, pokemonId: "garchomp", teamId: "source-1" }),
      makeDbSlot({
        id: 2,
        position: 2,
        pokemonId: "heatran",
        teamId: "source-1",
        ability: "Flash Fire",
        item: "Air Balloon",
        nature: "Timid",
        move1: "Magma Storm",
        move2: "Earth Power",
        move3: null,
        move4: null,
        evHp: 0,
        evAtk: 0,
        evDef: 0,
        evSpA: 252,
        evSpD: 4,
        evSpe: 252,
      }),
    ]
    const sourceDb = makeDbTeam({
      id: "source-1",
      name: "Source Team",
      slots: sourceSlots,
    })
    const forkedDb = makeDbTeam({
      id: "fork-1",
      name: "Source Team (fork)",
      parentId: "source-1",
      slots: sourceSlots.map((s) => ({ ...s, teamId: "fork-1" })),
    })

    const { txSlotCreate } = setupForkMocks(sourceDb, forkedDb)

    await forkTeam("source-1")

    expect(txSlotCreate).toHaveBeenCalledTimes(2)
    // Verify first slot
    expect(txSlotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "fork-1",
          pokemonId: "garchomp",
        }),
      }),
    )
    // Verify second slot
    expect(txSlotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "fork-1",
          pokemonId: "heatran",
        }),
      }),
    )
  })

  it("applies modifySlots option", async () => {
    const sourceSlot = makeDbSlot({ teamId: "source-1" })
    const sourceDb = makeDbTeam({
      id: "source-1",
      name: "Source Team",
      slots: [sourceSlot],
    })
    const forkedDb = makeDbTeam({
      id: "fork-1",
      name: "Modified Fork",
      parentId: "source-1",
      slots: [makeDbSlot({ teamId: "fork-1", item: "Choice Band" })],
    })

    const { txSlotCreate } = setupForkMocks(sourceDb, forkedDb)

    const options: ForkOptions = {
      name: "Modified Fork",
      modifySlots: [{ position: 1, pokemonId: "garchomp", item: "Choice Band" }],
    }

    await forkTeam("source-1", options)

    // The slot create call should use the modified item
    expect(txSlotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "fork-1",
          pokemonId: "garchomp",
          item: "Choice Band",
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — archiveTeam / restoreTeam
// ---------------------------------------------------------------------------

describe("archiveTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sets isArchived to true", async () => {
    mockTeamUpdate.mockResolvedValue(makeDbTeam({ isArchived: true }))

    await archiveTeam("team-1")

    expect(mockTeamUpdate).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { isArchived: true },
    })
  })
})

describe("restoreTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sets isArchived to false", async () => {
    mockTeamUpdate.mockResolvedValue(makeDbTeam({ isArchived: false }))

    await restoreTeam("team-1")

    expect(mockTeamUpdate).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { isArchived: false },
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — getLineageTree
// ---------------------------------------------------------------------------

describe("getLineageTree", () => {
  beforeEach(() => vi.clearAllMocks())

  it("builds correct tree for 3-level lineage", async () => {
    const now = new Date()

    // Walk-up calls: grandchild -> child -> root
    // First findUnique: grandchild (has parentId "child-1")
    // Second findUnique: child-1 (has parentId "root-1")
    // Third findUnique: root-1 (no parentId) — stops walk
    mockTeamFindUnique
      .mockResolvedValueOnce({ parentId: "child-1" }) // grandchild lookup
      .mockResolvedValueOnce({ parentId: "root-1" }) // child lookup
      .mockResolvedValueOnce({ parentId: null }) // root lookup

    // Batch loading: findMany for root, then children, then grandchildren
    const rootTeam = {
      id: "root-1",
      name: "Root",
      branchName: null,
      parentId: null,
      isArchived: false,
      createdAt: now,
      slots: [{ pokemonId: "garchomp" }],
    }
    const childTeam = {
      id: "child-1",
      name: "Child",
      branchName: "experiment",
      parentId: "root-1",
      isArchived: false,
      createdAt: now,
      slots: [{ pokemonId: "garchomp" }, { pokemonId: "heatran" }],
    }
    const grandchildTeam = {
      id: "grandchild-1",
      name: "Grandchild",
      branchName: null,
      parentId: "child-1",
      isArchived: false,
      createdAt: now,
      slots: [{ pokemonId: "garchomp" }, { pokemonId: "heatran" }, { pokemonId: "landorus" }],
    }

    // First findMany batch: load root by ID
    mockTeamFindMany
      .mockResolvedValueOnce([rootTeam]) // load root-1 by id
      .mockResolvedValueOnce([childTeam]) // children of root-1
      .mockResolvedValueOnce([childTeam]) // load child-1 by id (next queue item)
      .mockResolvedValueOnce([grandchildTeam]) // children of child-1
      .mockResolvedValueOnce([grandchildTeam]) // load grandchild-1 by id
      .mockResolvedValueOnce([]) // children of grandchild-1

    const tree = await getLineageTree("grandchild-1")

    expect(tree.teamId).toBe("root-1")
    expect(tree.name).toBe("Root")
    expect(tree.parentId).toBeNull()
    expect(tree.pokemonIds).toEqual(["garchomp"])

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].teamId).toBe("child-1")
    expect(tree.children[0].name).toBe("Child")
    expect(tree.children[0].branchName).toBe("experiment")

    expect(tree.children[0].children).toHaveLength(1)
    expect(tree.children[0].children[0].teamId).toBe("grandchild-1")
    expect(tree.children[0].children[0].slotCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Tests — mergeTeams
// ---------------------------------------------------------------------------

describe("mergeTeams", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates merged team with correct slots per decisions", async () => {
    const slotGarchomp = makeDbSlot({
      position: 1,
      pokemonId: "garchomp",
      teamId: "team-a",
    })
    const slotHeatran = makeDbSlot({
      id: 2,
      position: 2,
      pokemonId: "heatran",
      teamId: "team-a",
      ability: "Flash Fire",
      item: "Air Balloon",
      nature: "Timid",
      move1: "Magma Storm",
      move2: "Earth Power",
      move3: null,
      move4: null,
      evHp: 0,
      evAtk: 0,
      evDef: 0,
      evSpA: 252,
      evSpD: 4,
      evSpe: 252,
    })
    const slotLandorus = makeDbSlot({
      id: 3,
      position: 2,
      pokemonId: "landorus",
      teamId: "team-b",
      ability: "Intimidate",
      item: "Choice Scarf",
      nature: "Jolly",
      move1: "Earthquake",
      move2: "U-turn",
      move3: null,
      move4: null,
    })

    const dbTeamA = makeDbTeam({
      id: "team-a",
      name: "Team A",
      slots: [slotGarchomp, slotHeatran],
    })
    const dbTeamB = makeDbTeam({
      id: "team-b",
      name: "Team B",
      slots: [makeDbSlot({ position: 1, pokemonId: "garchomp", teamId: "team-b" }), slotLandorus],
    })

    // getTeam is called twice (for teamA and teamB)
    mockTeamFindUnique.mockResolvedValueOnce(dbTeamA).mockResolvedValueOnce(dbTeamB)

    const txTeamCreate = vi.fn().mockResolvedValue({ id: "merge-1" })
    const txSlotCreate = vi.fn().mockResolvedValue({})
    const txTeamFindUnique = vi.fn().mockResolvedValue(
      makeDbTeam({
        id: "merge-1",
        name: "Merge of Team A + Team B",
        parentId: "team-a",
        slots: [
          makeDbSlot({ position: 1, pokemonId: "garchomp", teamId: "merge-1" }),
          makeDbSlot({
            position: 2,
            pokemonId: "landorus",
            teamId: "merge-1",
            ability: "Intimidate",
            item: "Choice Scarf",
            nature: "Jolly",
            move1: "Earthquake",
            move2: "U-turn",
            move3: null,
            move4: null,
          }),
        ],
      }),
    )

    mockTransaction.mockImplementation(
      async (cb: (prisma: Record<string, Record<string, unknown>>) => Promise<unknown>) => {
        return cb({
          team: { create: txTeamCreate, findUnique: txTeamFindUnique },
          teamSlot: { create: txSlotCreate },
        })
      },
    )

    // Decisions: keep garchomp from A (unchanged), pick landorus from B
    const decisions: MergeDecision[] = [{ pokemonId: "landorus", source: "teamB" }]

    const result = await mergeTeams("team-a", "team-b", decisions)

    expect(result.id).toBe("merge-1")

    // Team create should include parentId pointing to teamA
    expect(txTeamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: "team-a",
        }),
      }),
    )

    // Should create slots for: garchomp (unchanged, from teamA) + landorus (decision)
    expect(txSlotCreate).toHaveBeenCalledTimes(2)
    expect(txSlotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "merge-1",
          pokemonId: "garchomp",
        }),
      }),
    )
    expect(txSlotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "merge-1",
          pokemonId: "landorus",
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — getTeamHistory
// ---------------------------------------------------------------------------

describe("getTeamHistory", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns ancestor chain in root-to-current order", async () => {
    const rootDb = makeDbTeam({
      id: "root-1",
      name: "Root",
      parentId: null,
      slots: [makeDbSlot({ teamId: "root-1" })],
    })
    const childDb = makeDbTeam({
      id: "child-1",
      name: "Child",
      parentId: "root-1",
      slots: [makeDbSlot({ teamId: "child-1" })],
    })
    const grandchildDb = makeDbTeam({
      id: "grandchild-1",
      name: "Grandchild",
      parentId: "child-1",
      slots: [makeDbSlot({ teamId: "grandchild-1" })],
    })

    // getTeamHistory calls getTeam repeatedly:
    // 1st call: grandchild-1
    // 2nd call: child-1 (grandchild's parentId)
    // 3rd call: root-1 (child's parentId)
    // 4th call: null (root has no parentId) — not called since parentId is null
    mockTeamFindUnique
      .mockResolvedValueOnce(grandchildDb)
      .mockResolvedValueOnce(childDb)
      .mockResolvedValueOnce(rootDb)

    const history = await getTeamHistory("grandchild-1")

    expect(history).toHaveLength(3)
    expect(history[0].id).toBe("root-1")
    expect(history[0].name).toBe("Root")
    expect(history[1].id).toBe("child-1")
    expect(history[1].name).toBe("Child")
    expect(history[2].id).toBe("grandchild-1")
    expect(history[2].name).toBe("Grandchild")
  })
})
