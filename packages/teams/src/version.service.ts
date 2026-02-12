import { prisma } from "@nasty-plot/db"
import { STATS } from "@nasty-plot/core"
import type {
  TeamData,
  TeamSlotData,
  TeamDiff,
  SlotChange,
  FieldChange,
  DiffSummary,
  MergeDecision,
  MergeOptions,
  ForkOptions,
  LineageNode,
} from "@nasty-plot/core"
import { getTeam, domainSlotToDb, dbSlotToDomain } from "./team.service"

const LINEAGE_SAFETY_LIMIT = 100

// --- Fork ---

export async function forkTeam(teamId: string, options?: ForkOptions): Promise<TeamData> {
  const source = await getTeam(teamId)
  if (!source) throw new Error("Source team not found")

  return prisma.$transaction(async (tx) => {
    const newTeam = await tx.team.create({
      data: {
        name: options?.name ?? `${source.name} (fork)`,
        formatId: source.formatId,
        mode: source.mode,
        notes: options?.notes ?? null,
        parentId: teamId,
        branchName: options?.branchName ?? null,
      },
    })

    for (const slot of source.slots) {
      const slotInput = {
        position: slot.position,
        pokemonId: slot.pokemonId,
        nickname: slot.nickname,
        ability: slot.ability,
        item: slot.item,
        nature: slot.nature,
        teraType: slot.teraType,
        level: slot.level,
        moves: slot.moves as [string, string?, string?, string?],
        evs: slot.evs,
        ivs: slot.ivs,
      }

      // Apply modifications if provided
      if (options?.modifySlots) {
        const mod = options.modifySlots.find(
          (m) => m.position === slot.position || m.pokemonId === slot.pokemonId,
        )
        if (mod) {
          Object.assign(slotInput, mod)
        }
      }

      const dbData = domainSlotToDb(slotInput)
      await tx.teamSlot.create({
        data: { teamId: newTeam.id, ...dbData },
      })
    }

    const result = await tx.team.findUnique({
      where: { id: newTeam.id },
      include: { slots: { orderBy: { position: "asc" } } },
    })

    return toTeamData(result!)
  })
}

// --- Compare ---

export function compareTeams(teamA: TeamData, teamB: TeamData): TeamDiff {
  const mapA = buildSlotMap(teamA.slots)
  const mapB = buildSlotMap(teamB.slots)

  const added: TeamSlotData[] = []
  const removed: TeamSlotData[] = []
  const changed: SlotChange[] = []
  const unchanged: string[] = []

  const processedB = new Set<string>()

  for (const [key, slotsA] of mapA) {
    const slotsB = mapB.get(key)
    if (!slotsB) {
      removed.push(...slotsA)
      continue
    }
    processedB.add(key)

    const pairCount = Math.max(slotsA.length, slotsB.length)
    for (let i = 0; i < pairCount; i++) {
      const slotA = slotsA[i]
      const slotB = slotsB[i]

      if (!slotA) {
        added.push(slotB)
      } else if (!slotB) {
        removed.push(slotA)
      } else {
        const changes = diffSlot(slotA, slotB)
        if (changes.length === 0) {
          unchanged.push(key)
        } else {
          changed.push({
            pokemonId: key,
            name: slotA.species?.name ?? slotA.pokemonId,
            changes,
          })
        }
      }
    }
  }

  for (const [key, slotsB] of mapB) {
    if (!processedB.has(key)) {
      added.push(...slotsB)
    }
  }

  const summary: DiffSummary = {
    totalChanges: added.length + removed.length + changed.length,
    slotsAdded: added.length,
    slotsRemoved: removed.length,
    slotsChanged: changed.length,
    slotsUnchanged: unchanged.length,
  }

  return {
    teamAId: teamA.id,
    teamBId: teamB.id,
    teamAName: teamA.name,
    teamBName: teamB.name,
    added,
    removed,
    changed,
    unchanged,
    summary,
  }
}

// --- Merge ---

export async function mergeTeams(
  teamAId: string,
  teamBId: string,
  decisions: MergeDecision[],
  options?: MergeOptions,
): Promise<TeamData> {
  const teamA = await getTeam(teamAId)
  const teamB = await getTeam(teamBId)
  if (!teamA) throw new Error("Team A not found")
  if (!teamB) throw new Error("Team B not found")

  const diff = compareTeams(teamA, teamB)
  const slots: TeamSlotData[] = []

  // Include unchanged Pokemon from teamA
  for (const pokemonId of diff.unchanged) {
    const slot = teamA.slots.find((s) => s.pokemonId === pokemonId)
    if (slot) slots.push(slot)
  }

  // Apply decisions for changed/added/removed Pokemon
  for (const decision of decisions) {
    const source = decision.source === "teamA" ? teamA : teamB
    const slot = source.slots.find((s) => s.pokemonId === decision.pokemonId)
    if (slot) slots.push(slot)
  }

  return prisma.$transaction(async (tx) => {
    const mergeNotes = options?.notes ? options.notes : `Merged from ${teamB.name} (${teamBId})`

    const newTeam = await tx.team.create({
      data: {
        name: options?.name ?? `Merge of ${teamA.name} + ${teamB.name}`,
        formatId: teamA.formatId,
        mode: teamA.mode,
        notes: mergeNotes,
        parentId: teamAId,
        branchName: options?.branchName ?? null,
      },
    })

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const slotInput = {
        position: i + 1,
        pokemonId: slot.pokemonId,
        nickname: slot.nickname,
        ability: slot.ability,
        item: slot.item,
        nature: slot.nature,
        teraType: slot.teraType,
        level: slot.level,
        moves: slot.moves as [string, string?, string?, string?],
        evs: slot.evs,
        ivs: slot.ivs,
      }
      const dbData = domainSlotToDb(slotInput)
      await tx.teamSlot.create({
        data: { teamId: newTeam.id, ...dbData },
      })
    }

    const result = await tx.team.findUnique({
      where: { id: newTeam.id },
      include: { slots: { orderBy: { position: "asc" } } },
    })

    return toTeamData(result!)
  })
}

// --- Lineage Tree ---

export async function getLineageTree(teamId: string): Promise<LineageNode> {
  // Walk up to find root
  let currentId = teamId
  let depth = 0
  while (depth < LINEAGE_SAFETY_LIMIT) {
    const team = await prisma.team.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    })
    if (!team || !team.parentId) break
    currentId = team.parentId
    depth++
  }
  const rootId = currentId

  // Batch-load all teams in lineage by traversing down from root
  const allTeams = new Map<
    string,
    {
      id: string
      name: string
      branchName: string | null
      parentId: string | null
      isArchived: boolean
      createdAt: Date
      slots: { pokemonId: string }[]
    }
  >()

  const queue = [rootId]
  while (queue.length > 0 && allTeams.size < LINEAGE_SAFETY_LIMIT) {
    const batch = queue.splice(0, 50)
    const teams = await prisma.team.findMany({
      where: { id: { in: batch } },
      select: {
        id: true,
        name: true,
        branchName: true,
        parentId: true,
        isArchived: true,
        createdAt: true,
        slots: { select: { pokemonId: true } },
      },
    })

    for (const t of teams) {
      allTeams.set(t.id, t)
    }

    // Find children of these teams
    const children = await prisma.team.findMany({
      where: { parentId: { in: batch } },
      select: {
        id: true,
        name: true,
        branchName: true,
        parentId: true,
        isArchived: true,
        createdAt: true,
        slots: { select: { pokemonId: true } },
      },
    })

    for (const c of children) {
      if (!allTeams.has(c.id)) {
        allTeams.set(c.id, c)
        queue.push(c.id)
      }
    }
  }

  // Build tree
  function buildNode(id: string): LineageNode | null {
    const team = allTeams.get(id)
    if (!team) return null

    const childTeams = Array.from(allTeams.values()).filter((t) => t.parentId === id)

    return {
      teamId: team.id,
      name: team.name,
      branchName: team.branchName ?? undefined,
      parentId: team.parentId,
      children: childTeams.map((c) => buildNode(c.id)).filter((n): n is LineageNode => n !== null),
      createdAt: team.createdAt.toISOString(),
      isArchived: team.isArchived,
      slotCount: team.slots.length,
      pokemonIds: team.slots.map((s) => s.pokemonId),
    }
  }

  const tree = buildNode(rootId)
  if (!tree) throw new Error("Team not found")
  return tree
}

// --- Team History ---

export async function getTeamHistory(teamId: string): Promise<TeamData[]> {
  const chain: TeamData[] = []
  let currentId: string | null = teamId
  let depth = 0

  while (currentId && depth < LINEAGE_SAFETY_LIMIT) {
    const team = await getTeam(currentId)
    if (!team) break
    chain.unshift(team)
    currentId = team.parentId ?? null
    depth++
  }

  return chain
}

// --- Archive / Restore ---

export async function archiveTeam(teamId: string): Promise<void> {
  await prisma.team.update({
    where: { id: teamId },
    data: { isArchived: true },
  })
}

export async function restoreTeam(teamId: string): Promise<void> {
  await prisma.team.update({
    where: { id: teamId },
    data: { isArchived: false },
  })
}

// --- Internal Helpers ---

function buildSlotMap(slots: TeamSlotData[]): Map<string, TeamSlotData[]> {
  const map = new Map<string, TeamSlotData[]>()
  for (const slot of slots) {
    const existing = map.get(slot.pokemonId) ?? []
    existing.push(slot)
    map.set(slot.pokemonId, existing)
  }
  return map
}

const FIELD_LABELS: Record<string, string> = {
  ability: "Ability",
  item: "Item",
  nature: "Nature",
  teraType: "Tera Type",
  level: "Level",
  nickname: "Nickname",
  "moves[0]": "Move 1",
  "moves[1]": "Move 2",
  "moves[2]": "Move 3",
  "moves[3]": "Move 4",
  "evs.hp": "HP EVs",
  "evs.atk": "Attack EVs",
  "evs.def": "Defense EVs",
  "evs.spa": "Sp. Atk EVs",
  "evs.spd": "Sp. Def EVs",
  "evs.spe": "Speed EVs",
  "ivs.hp": "HP IVs",
  "ivs.atk": "Attack IVs",
  "ivs.def": "Defense IVs",
  "ivs.spa": "Sp. Atk IVs",
  "ivs.spd": "Sp. Def IVs",
  "ivs.spe": "Speed IVs",
}

function diffSlot(a: TeamSlotData, b: TeamSlotData): FieldChange[] {
  const changes: FieldChange[] = []

  function check(
    field: string,
    valA: string | number | undefined,
    valB: string | number | undefined,
  ) {
    if (valA !== valB) {
      changes.push({
        field,
        label: FIELD_LABELS[field] ?? field,
        before: valA,
        after: valB,
      })
    }
  }

  check("ability", a.ability, b.ability)
  check("item", a.item, b.item)
  check("nature", a.nature, b.nature)
  check("teraType", a.teraType, b.teraType)
  check("level", a.level, b.level)
  check("nickname", a.nickname, b.nickname)

  for (let i = 0; i < 4; i++) {
    check(`moves[${i}]`, a.moves[i], b.moves[i])
  }

  for (const stat of STATS) {
    check(`evs.${stat}`, a.evs[stat], b.evs[stat])
    check(`ivs.${stat}`, a.ivs[stat], b.ivs[stat])
  }

  return changes
}

type DbTeamResult = {
  id: string
  name: string
  formatId: string
  mode: string
  notes: string | null
  parentId: string | null
  branchName: string | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  slots: {
    id: number
    teamId: string
    position: number
    pokemonId: string
    nickname: string | null
    ability: string
    item: string
    nature: string
    teraType: string | null
    level: number
    move1: string
    move2: string | null
    move3: string | null
    move4: string | null
    evHp: number
    evAtk: number
    evDef: number
    evSpA: number
    evSpD: number
    evSpe: number
    ivHp: number
    ivAtk: number
    ivDef: number
    ivSpA: number
    ivSpD: number
    ivSpe: number
  }[]
}

function toTeamData(db: DbTeamResult): TeamData {
  return {
    id: db.id,
    name: db.name,
    formatId: db.formatId,
    mode: db.mode as "freeform" | "guided",
    notes: db.notes ?? undefined,
    parentId: db.parentId ?? undefined,
    branchName: db.branchName ?? undefined,
    isArchived: db.isArchived,
    slots: db.slots.sort((a, b) => a.position - b.position).map(dbSlotToDomain),
    createdAt: db.createdAt.toISOString(),
    updatedAt: db.updatedAt.toISOString(),
  }
}
