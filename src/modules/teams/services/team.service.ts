import { prisma } from "@/shared/services/prisma";
import type {
  NatureName,
  StatsTable,
  TeamCreateInput,
  TeamData,
  TeamSlotData,
  TeamSlotInput,
} from "@/shared/types";

// --- DB <-> Domain Mapping Helpers ---

function dbSlotToDomain(
  dbSlot: {
    id: number;
    teamId: string;
    position: number;
    pokemonId: string;
    ability: string;
    item: string;
    nature: string;
    teraType: string | null;
    level: number;
    move1: string;
    move2: string | null;
    move3: string | null;
    move4: string | null;
    evHp: number;
    evAtk: number;
    evDef: number;
    evSpA: number;
    evSpD: number;
    evSpe: number;
    ivHp: number;
    ivAtk: number;
    ivDef: number;
    ivSpA: number;
    ivSpD: number;
    ivSpe: number;
  }
): TeamSlotData {
  return {
    position: dbSlot.position,
    pokemonId: dbSlot.pokemonId,
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
  };
}

function domainSlotToDb(slot: TeamSlotInput) {
  return {
    position: slot.position,
    pokemonId: slot.pokemonId,
    ability: slot.ability,
    item: slot.item,
    nature: slot.nature,
    teraType: slot.teraType ?? null,
    level: slot.level,
    move1: slot.moves[0] || "",
    move2: slot.moves[1] ?? null,
    move3: slot.moves[2] ?? null,
    move4: slot.moves[3] ?? null,
    evHp: slot.evs.hp,
    evAtk: slot.evs.atk,
    evDef: slot.evs.def,
    evSpA: slot.evs.spa,
    evSpD: slot.evs.spd,
    evSpe: slot.evs.spe,
    ivHp: slot.ivs.hp,
    ivAtk: slot.ivs.atk,
    ivDef: slot.ivs.def,
    ivSpA: slot.ivs.spa,
    ivSpD: slot.ivs.spd,
    ivSpe: slot.ivs.spe,
  };
}

function dbTeamToDomain(
  dbTeam: {
    id: string;
    name: string;
    formatId: string;
    mode: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    slots: Array<{
      id: number;
      teamId: string;
      position: number;
      pokemonId: string;
      ability: string;
      item: string;
      nature: string;
      teraType: string | null;
      level: number;
      move1: string;
      move2: string | null;
      move3: string | null;
      move4: string | null;
      evHp: number;
      evAtk: number;
      evDef: number;
      evSpA: number;
      evSpD: number;
      evSpe: number;
      ivHp: number;
      ivAtk: number;
      ivDef: number;
      ivSpA: number;
      ivSpD: number;
      ivSpe: number;
    }>;
  }
): TeamData {
  return {
    id: dbTeam.id,
    name: dbTeam.name,
    formatId: dbTeam.formatId,
    mode: dbTeam.mode as "freeform" | "guided",
    notes: dbTeam.notes ?? undefined,
    slots: dbTeam.slots
      .sort((a, b) => a.position - b.position)
      .map(dbSlotToDomain),
    createdAt: dbTeam.createdAt.toISOString(),
    updatedAt: dbTeam.updatedAt.toISOString(),
  };
}

// --- Service Functions ---

export async function createTeam(input: TeamCreateInput): Promise<TeamData> {
  // Auto-create Format record if it doesn't exist to avoid FK violations
  await prisma.format.upsert({
    where: { id: input.formatId },
    update: {},
    create: {
      id: input.formatId,
      name: input.formatId,
      generation: parseInt(input.formatId.replace(/[^0-9]/g, "").charAt(0) || "9"),
      gameType: input.formatId.includes("doubles") || input.formatId.includes("vgc") ? "doubles" : "singles",
      isActive: true,
    },
  });

  const team = await prisma.team.create({
    data: {
      name: input.name,
      formatId: input.formatId,
      mode: input.mode ?? "freeform",
      notes: input.notes ?? null,
    },
    include: { slots: true },
  });
  return dbTeamToDomain(team);
}

export async function getTeam(id: string): Promise<TeamData | null> {
  const team = await prisma.team.findUnique({
    where: { id },
    include: { slots: { orderBy: { position: "asc" } } },
  });
  if (!team) return null;
  return dbTeamToDomain(team);
}

export async function listTeams(filters?: {
  formatId?: string;
}): Promise<TeamData[]> {
  const teams = await prisma.team.findMany({
    where: filters?.formatId ? { formatId: filters.formatId } : undefined,
    include: { slots: { orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return teams.map(dbTeamToDomain);
}

export async function updateTeam(
  id: string,
  data: Partial<TeamCreateInput>
): Promise<TeamData> {
  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.formatId !== undefined && { formatId: data.formatId }),
      ...(data.mode !== undefined && { mode: data.mode }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
    },
    include: { slots: { orderBy: { position: "asc" } } },
  });
  return dbTeamToDomain(team);
}

export async function deleteTeam(id: string): Promise<void> {
  await prisma.team.delete({ where: { id } });
}

export async function addSlot(
  teamId: string,
  slot: TeamSlotInput
): Promise<TeamSlotData> {
  const existingCount = await prisma.teamSlot.count({ where: { teamId } });
  if (existingCount >= 6) {
    throw new Error("Team already has 6 slots");
  }

  const dbData = domainSlotToDb(slot);
  const created = await prisma.teamSlot.create({
    data: { teamId, ...dbData },
  });
  return dbSlotToDomain(created);
}

export async function updateSlot(
  teamId: string,
  position: number,
  data: Partial<TeamSlotInput>
): Promise<TeamSlotData> {
  const updateData: Record<string, unknown> = {};

  if (data.pokemonId !== undefined) updateData.pokemonId = data.pokemonId;
  if (data.ability !== undefined) updateData.ability = data.ability;
  if (data.item !== undefined) updateData.item = data.item;
  if (data.nature !== undefined) updateData.nature = data.nature;
  if (data.teraType !== undefined) updateData.teraType = data.teraType ?? null;
  if (data.level !== undefined) updateData.level = data.level;

  if (data.moves !== undefined) {
    updateData.move1 = data.moves[0] || "";
    updateData.move2 = data.moves[1] ?? null;
    updateData.move3 = data.moves[2] ?? null;
    updateData.move4 = data.moves[3] ?? null;
  }

  if (data.evs !== undefined) {
    updateData.evHp = data.evs.hp;
    updateData.evAtk = data.evs.atk;
    updateData.evDef = data.evs.def;
    updateData.evSpA = data.evs.spa;
    updateData.evSpD = data.evs.spd;
    updateData.evSpe = data.evs.spe;
  }

  if (data.ivs !== undefined) {
    updateData.ivHp = data.ivs.hp;
    updateData.ivAtk = data.ivs.atk;
    updateData.ivDef = data.ivs.def;
    updateData.ivSpA = data.ivs.spa;
    updateData.ivSpD = data.ivs.spd;
    updateData.ivSpe = data.ivs.spe;
  }

  const updated = await prisma.teamSlot.update({
    where: { teamId_position: { teamId, position } },
    data: updateData,
  });
  return dbSlotToDomain(updated);
}

export async function removeSlot(
  teamId: string,
  position: number
): Promise<void> {
  await prisma.teamSlot.delete({
    where: { teamId_position: { teamId, position } },
  });

  // Reorder remaining slots
  const remaining = await prisma.teamSlot.findMany({
    where: { teamId },
    orderBy: { position: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    const newPosition = i + 1;
    if (remaining[i].position !== newPosition) {
      await prisma.teamSlot.update({
        where: { id: remaining[i].id },
        data: { position: newPosition },
      });
    }
  }
}

export async function reorderSlots(
  teamId: string,
  newOrder: number[]
): Promise<void> {
  const slots = await prisma.teamSlot.findMany({
    where: { teamId },
    orderBy: { position: "asc" },
  });

  // Capture original position -> id mapping before any updates
  const posToId = new Map<number, number>();
  for (const slot of slots) {
    posToId.set(slot.position, slot.id);
  }

  // Use temporary positions to avoid unique constraint conflicts
  const tempOffset = 100;
  for (let i = 0; i < slots.length; i++) {
    await prisma.teamSlot.update({
      where: { id: slots[i].id },
      data: { position: tempOffset + i },
    });
  }

  // Now assign final positions based on newOrder
  for (let i = 0; i < newOrder.length; i++) {
    const slotId = posToId.get(newOrder[i]);
    if (slotId !== undefined) {
      await prisma.teamSlot.update({
        where: { id: slotId },
        data: { position: i + 1 },
      });
    }
  }
}
