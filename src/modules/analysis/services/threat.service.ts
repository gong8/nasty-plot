import type { TeamSlotData, ThreatEntry, PokemonType } from "@/shared/types";
import { prisma } from "@/shared/services/prisma";
import { getTypeEffectiveness, getWeaknesses } from "@/shared/lib/type-chart";
import { Dex } from "@pkmn/dex";

/**
 * Identify threats to the team based on usage stats and type matchups.
 */
export async function identifyThreats(
  slots: TeamSlotData[],
  formatId: string
): Promise<ThreatEntry[]> {
  // Collect team weaknesses
  const teamWeaknesses = new Set<PokemonType>();
  for (const slot of slots) {
    const types = slot.species?.types ?? [];
    if (types.length === 0) continue;
    const weaks = getWeaknesses(types as PokemonType[]);
    for (const w of weaks) {
      teamWeaknesses.add(w);
    }
  }

  // Get top usage Pokemon for this format
  const now = new Date();
  const usageEntries = await prisma.usageStats.findMany({
    where: {
      formatId,
    },
    orderBy: { rank: "asc" },
    take: 50,
  });

  if (usageEntries.length === 0) {
    return [];
  }

  const teamPokemonIds = new Set(slots.map((s) => s.pokemonId));
  const threats: ThreatEntry[] = [];

  for (const entry of usageEntries) {
    if (teamPokemonIds.has(entry.pokemonId)) continue;

    // Resolve species types
    const species = Dex.species.get(entry.pokemonId);
    if (!species?.exists) continue;

    const threatTypes = species.types as PokemonType[];
    let threatScore = 0;
    const reasons: string[] = [];

    // Check if this threat exploits team weaknesses with STAB
    for (const tType of threatTypes) {
      let weakSlots = 0;
      for (const slot of slots) {
        const defTypes = slot.species?.types ?? [];
        if (defTypes.length === 0) continue;
        const eff = getTypeEffectiveness(tType, defTypes as PokemonType[]);
        if (eff > 1) weakSlots++;
      }
      if (weakSlots >= 2) {
        threatScore += weakSlots * 15;
        reasons.push(`${tType}-type STAB hits ${weakSlots} team members super-effectively`);
      } else if (weakSlots === 1) {
        threatScore += 5;
      }
    }

    // Higher usage = higher threat baseline
    threatScore += Math.min(entry.usagePercent * 2, 30);

    // Determine threat level
    let threatLevel: "high" | "medium" | "low";
    if (threatScore >= 40) {
      threatLevel = "high";
    } else if (threatScore >= 20) {
      threatLevel = "medium";
    } else {
      threatLevel = "low";
    }

    // Only include medium+ threats
    if (threatLevel === "low" && threatScore < 10) continue;

    threats.push({
      pokemonId: entry.pokemonId,
      pokemonName: species.name,
      usagePercent: entry.usagePercent,
      threatLevel,
      reason: reasons.length > 0
        ? reasons.join("; ")
        : `High usage (${entry.usagePercent.toFixed(1)}%) in the metagame`,
    });
  }

  // Sort: high first, then medium, then low; within each level, by usage
  const levelOrder = { high: 0, medium: 1, low: 2 };
  threats.sort((a, b) => {
    const levelDiff = levelOrder[a.threatLevel] - levelOrder[b.threatLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.usagePercent - a.usagePercent;
  });

  return threats.slice(0, 20);
}
