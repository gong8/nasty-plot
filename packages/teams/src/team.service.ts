import { prisma } from "@nasty-plot/db"
import { getSpecies } from "@nasty-plot/pokemon-data"
import type {
  NatureName,
  StatsTable,
  TeamCreateInput,
  TeamData,
  TeamSlotData,
  TeamSlotInput,
} from "@nasty-plot/core"

// --- DB Row Types ---

type DbSlotRow = {
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
}

type DbTeamRow = {
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
  slots: DbSlotRow[]
}

// --- DB <-> Domain Mapping ---

function evsToDb(evs: StatsTable) {
  return {
    evHp: evs.hp,
    evAtk: evs.atk,
    evDef: evs.def,
    evSpA: evs.spa,
    evSpD: evs.spd,
    evSpe: evs.spe,
  }
}

function ivsToDb(ivs: StatsTable) {
  return {
    ivHp: ivs.hp,
    ivAtk: ivs.atk,
    ivDef: ivs.def,
    ivSpA: ivs.spa,
    ivSpD: ivs.spd,
    ivSpe: ivs.spe,
  }
}

function validateNoDuplicateMoves(moves: TeamSlotInput["moves"]) {
  const seen = new Set<string>()
  for (const move of moves) {
    if (!move) continue
    const lower = move.toLowerCase()
    if (seen.has(lower)) {
      throw new Error(`Duplicate move: ${move}`)
    }
    seen.add(lower)
  }
}

function movesToDb(moves: TeamSlotInput["moves"]) {
  validateNoDuplicateMoves(moves)
  return {
    move1: moves[0] || "",
    move2: moves[1] ?? null,
    move3: moves[2] ?? null,
    move4: moves[3] ?? null,
  }
}

function dbSlotToDomain(dbSlot: DbSlotRow): TeamSlotData {
  const species = getSpecies(dbSlot.pokemonId)
  return {
    position: dbSlot.position,
    pokemonId: dbSlot.pokemonId,
    nickname: dbSlot.nickname ?? undefined,
    species: species ?? undefined,
    ability: dbSlot.ability,
    item: dbSlot.item,
    nature: dbSlot.nature as NatureName,
    teraType: dbSlot.teraType as TeamSlotData["teraType"],
    level: dbSlot.level,
    moves: [
      dbSlot.move1,
      dbSlot.move2 ?? undefined,
      dbSlot.move3 ?? undefined,
      dbSlot.move4 ?? undefined,
    ],
    evs: {
      hp: dbSlot.evHp,
      atk: dbSlot.evAtk,
      def: dbSlot.evDef,
      spa: dbSlot.evSpA,
      spd: dbSlot.evSpD,
      spe: dbSlot.evSpe,
    },
    ivs: {
      hp: dbSlot.ivHp,
      atk: dbSlot.ivAtk,
      def: dbSlot.ivDef,
      spa: dbSlot.ivSpA,
      spd: dbSlot.ivSpD,
      spe: dbSlot.ivSpe,
    },
  }
}

export function domainSlotToDb(slot: TeamSlotInput) {
  return {
    position: slot.position,
    pokemonId: slot.pokemonId,
    nickname: slot.nickname ?? null,
    ability: slot.ability,
    item: slot.item,
    nature: slot.nature,
    teraType: slot.teraType ?? null,
    level: slot.level,
    ...movesToDb(slot.moves),
    ...evsToDb(slot.evs),
    ...ivsToDb(slot.ivs),
  }
}

function dbTeamToDomain(dbTeam: DbTeamRow): TeamData {
  return {
    id: dbTeam.id,
    name: dbTeam.name,
    formatId: dbTeam.formatId,
    mode: dbTeam.mode as "freeform" | "guided",
    notes: dbTeam.notes ?? undefined,
    parentId: dbTeam.parentId ?? undefined,
    branchName: dbTeam.branchName ?? undefined,
    isArchived: dbTeam.isArchived,
    slots: dbTeam.slots.sort((a, b) => a.position - b.position).map(dbSlotToDomain),
    createdAt: dbTeam.createdAt.toISOString(),
    updatedAt: dbTeam.updatedAt.toISOString(),
  }
}

// --- Service Functions ---

function parseGeneration(formatId: string): number {
  const digits = formatId.replace(/[^0-9]/g, "")
  return parseInt(digits.charAt(0) || "9")
}

function inferGameType(formatId: string): "singles" | "doubles" {
  return formatId.includes("doubles") || formatId.includes("vgc") ? "doubles" : "singles"
}

export async function createTeam(input: TeamCreateInput): Promise<TeamData> {
  // Auto-create Format record if it doesn't exist to avoid FK violations
  await prisma.format.upsert({
    where: { id: input.formatId },
    update: {},
    create: {
      id: input.formatId,
      name: input.formatId,
      generation: parseGeneration(input.formatId),
      gameType: inferGameType(input.formatId),
      isActive: true,
    },
  })

  const team = await prisma.team.create({
    data: {
      name: input.name,
      formatId: input.formatId,
      mode: input.mode ?? "freeform",
      notes: input.notes ?? null,
    },
    include: { slots: true },
  })
  return dbTeamToDomain(team)
}

export async function getTeam(id: string): Promise<TeamData | null> {
  const team = await prisma.team.findUnique({
    where: { id },
    include: { slots: { orderBy: { position: "asc" } } },
  })
  if (!team) return null
  return dbTeamToDomain(team)
}

export async function listTeams(filters?: {
  formatId?: string
  includeArchived?: boolean
}): Promise<TeamData[]> {
  const where: Record<string, unknown> = {}
  if (filters?.formatId) where.formatId = filters.formatId
  if (!filters?.includeArchived) where.isArchived = false

  const teams = await prisma.team.findMany({
    where,
    include: { slots: { orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
  })
  return teams.map(dbTeamToDomain)
}

export async function updateTeam(id: string, data: Partial<TeamCreateInput>): Promise<TeamData> {
  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.formatId !== undefined && { formatId: data.formatId }),
      ...(data.mode !== undefined && { mode: data.mode }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
    },
    include: { slots: { orderBy: { position: "asc" } } },
  })
  return dbTeamToDomain(team)
}

export async function deleteTeam(id: string): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id }, select: { parentId: true } })
  if (team) {
    await prisma.team.updateMany({
      where: { parentId: id },
      data: { parentId: team.parentId },
    })
  }
  await prisma.team.delete({ where: { id } })
}

export async function addSlot(teamId: string, slot: TeamSlotInput): Promise<TeamSlotData> {
  const existingCount = await prisma.teamSlot.count({ where: { teamId } })
  if (existingCount >= 6) {
    throw new Error("Team already has 6 slots")
  }

  const dbData = domainSlotToDb(slot)
  const created = await prisma.teamSlot.create({
    data: { teamId, ...dbData },
  })
  return dbSlotToDomain(created)
}

export async function updateSlot(
  teamId: string,
  position: number,
  data: Partial<TeamSlotInput>,
): Promise<TeamSlotData> {
  const updateData: Record<string, unknown> = {}

  if (data.pokemonId !== undefined) updateData.pokemonId = data.pokemonId
  if (data.nickname !== undefined) updateData.nickname = data.nickname ?? null
  if (data.ability !== undefined) updateData.ability = data.ability
  if (data.item !== undefined) updateData.item = data.item
  if (data.nature !== undefined) updateData.nature = data.nature
  if (data.teraType !== undefined) updateData.teraType = data.teraType ?? null
  if (data.level !== undefined) updateData.level = data.level

  if (data.moves !== undefined) Object.assign(updateData, movesToDb(data.moves))
  if (data.evs !== undefined) Object.assign(updateData, evsToDb(data.evs))
  if (data.ivs !== undefined) Object.assign(updateData, ivsToDb(data.ivs))

  const updated = await prisma.teamSlot.update({
    where: { teamId_position: { teamId, position } },
    data: updateData,
  })
  return dbSlotToDomain(updated)
}

export async function removeSlot(teamId: string, position: number): Promise<void> {
  await prisma.teamSlot.delete({
    where: { teamId_position: { teamId, position } },
  })

  const remaining = await prisma.teamSlot.findMany({
    where: { teamId },
    orderBy: { position: "asc" },
  })

  for (let i = 0; i < remaining.length; i++) {
    const newPosition = i + 1
    if (remaining[i].position !== newPosition) {
      await prisma.teamSlot.update({
        where: { id: remaining[i].id },
        data: { position: newPosition },
      })
    }
  }
}

export async function clearSlots(teamId: string): Promise<void> {
  await prisma.teamSlot.deleteMany({ where: { teamId } })
}

export async function reorderSlots(teamId: string, newOrder: number[]): Promise<void> {
  const slots = await prisma.teamSlot.findMany({
    where: { teamId },
    orderBy: { position: "asc" },
  })

  const posToId = new Map(slots.map((s) => [s.position, s.id]))

  // Use temporary positions to avoid unique constraint conflicts
  const tempOffset = 100
  for (let i = 0; i < slots.length; i++) {
    await prisma.teamSlot.update({
      where: { id: slots[i].id },
      data: { position: tempOffset + i },
    })
  }

  for (let i = 0; i < newOrder.length; i++) {
    const slotId = posToId.get(newOrder[i])
    if (slotId !== undefined) {
      await prisma.teamSlot.update({
        where: { id: slotId },
        data: { position: i + 1 },
      })
    }
  }
}
