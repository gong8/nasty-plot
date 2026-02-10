import { DEFAULT_EVS, DEFAULT_IVS } from "@/shared/constants";
import {
  parseShowdownPaste,
  serializeShowdownPaste,
} from "@/shared/lib/showdown-paste";
import type { NatureName, TeamData, TeamSlotInput } from "@/shared/types";
import { addSlot, createTeam, getTeam } from "./team.service";

export async function importShowdownPaste(
  paste: string,
  formatId: string,
  teamName?: string
): Promise<TeamData> {
  const parsed = parseShowdownPaste(paste);
  if (parsed.length === 0) {
    throw new Error("No valid Pokemon found in paste");
  }

  const team = await createTeam({
    name: teamName || "Imported Team",
    formatId,
  });

  for (let i = 0; i < Math.min(parsed.length, 6); i++) {
    const p = parsed[i];
    const slotInput: TeamSlotInput = {
      position: i + 1,
      pokemonId: p.pokemonId || "",
      nickname: p.nickname,
      ability: p.ability || "",
      item: p.item || "",
      nature: (p.nature || "Hardy") as NatureName,
      teraType: p.teraType,
      level: p.level ?? 100,
      moves: [
        p.moves?.[0] || "",
        p.moves?.[1],
        p.moves?.[2],
        p.moves?.[3],
      ],
      evs: p.evs || { ...DEFAULT_EVS },
      ivs: p.ivs || { ...DEFAULT_IVS },
    };
    await addSlot(team.id, slotInput);
  }

  const result = await getTeam(team.id);
  return result!;
}

export async function exportShowdownPaste(teamId: string): Promise<string> {
  const team = await getTeam(teamId);
  if (!team) {
    throw new Error("Team not found");
  }
  return serializeShowdownPaste(team.slots);
}
