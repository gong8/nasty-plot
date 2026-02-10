import {
  DEFAULT_EVS,
  DEFAULT_IVS,
  parseShowdownPaste,
  serializeShowdownPaste,
} from "@nasty-plot/core"
import type { NatureName, TeamData, TeamSlotInput } from "@nasty-plot/core"
import { addSlot, clearSlots, createTeam, getTeam } from "./team.service"

/**
 * Import a Showdown paste as a brand-new team.
 */
export async function importShowdownPaste(
  paste: string,
  formatId: string,
  teamName?: string,
): Promise<TeamData> {
  const slotInputs = buildSlotInputs(paste)

  const team = await createTeam({
    name: teamName || "Imported Team",
    formatId,
  })

  for (const slotInput of slotInputs) {
    await addSlot(team.id, slotInput)
  }

  const result = await getTeam(team.id)
  return result!
}

function buildSlotInputs(paste: string): TeamSlotInput[] {
  const parsed = parseShowdownPaste(paste)
  if (parsed.length === 0) {
    throw new Error("No valid Pokemon found in paste")
  }

  return parsed.slice(0, 6).map((p, i) => ({
    position: i + 1,
    pokemonId: p.pokemonId || "",
    nickname: p.nickname,
    ability: p.ability || "",
    item: p.item || "",
    nature: (p.nature || "Hardy") as NatureName,
    teraType: p.teraType,
    level: p.level ?? 100,
    moves: [p.moves?.[0] || "", p.moves?.[1], p.moves?.[2], p.moves?.[3]] as TeamSlotInput["moves"],
    evs: p.evs || { ...DEFAULT_EVS },
    ivs: p.ivs || { ...DEFAULT_IVS },
  }))
}

/**
 * Import a Showdown paste into an existing team, replacing all current slots.
 */
export async function importIntoTeam(teamId: string, paste: string): Promise<TeamData> {
  const slotInputs = buildSlotInputs(paste)

  await clearSlots(teamId)
  for (const slotInput of slotInputs) {
    await addSlot(teamId, slotInput)
  }

  const result = await getTeam(teamId)
  return result!
}

export async function exportShowdownPaste(teamId: string): Promise<string> {
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error("Team not found")
  }
  return serializeShowdownPaste(team.slots)
}
