import type { TeamSlotData, TeamAnalysis, SpeedTierEntry, PokemonType } from "@/shared/types";
import { analyzeTypeCoverage } from "./coverage.service";
import { identifyThreats } from "./threat.service";
import { calculateSynergy } from "./synergy.service";
import { calculateAllStats } from "@/shared/lib/stat-calc";
import { DEFAULT_IVS, DEFAULT_EVS } from "@/shared/constants";
import { prisma } from "@/shared/services/prisma";

/**
 * Full team analysis orchestrator.
 */
export async function analyzeTeam(teamId: string): Promise<TeamAnalysis> {
  // Load team from DB
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { slots: true },
  });

  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }

  // Convert DB slots to TeamSlotData
  const { Dex } = await import("@pkmn/dex");

  const slots: TeamSlotData[] = team.slots.map((s: typeof team.slots[number]) => {
    const species = Dex.species.get(s.pokemonId);
    const speciesData = species?.exists
      ? {
          id: s.pokemonId,
          name: species.name,
          num: species.num,
          types: species.types as [PokemonType] | [PokemonType, PokemonType],
          baseStats: {
            hp: species.baseStats.hp,
            atk: species.baseStats.atk,
            def: species.baseStats.def,
            spa: species.baseStats.spa,
            spd: species.baseStats.spd,
            spe: species.baseStats.spe,
          },
          abilities: Object.fromEntries(
            Object.entries(species.abilities).filter(([, v]) => v)
          ),
          weightkg: species.weightkg,
        }
      : undefined;

    return {
      position: s.position,
      pokemonId: s.pokemonId,
      species: speciesData,
      ability: s.ability,
      item: s.item,
      nature: s.nature as TeamSlotData["nature"],
      teraType: (s.teraType as PokemonType) ?? undefined,
      level: s.level,
      moves: [s.move1, s.move2 ?? undefined, s.move3 ?? undefined, s.move4 ?? undefined] as TeamSlotData["moves"],
      evs: {
        hp: s.evHp,
        atk: s.evAtk,
        def: s.evDef,
        spa: s.evSpA,
        spd: s.evSpD,
        spe: s.evSpe,
      },
      ivs: {
        hp: s.ivHp,
        atk: s.ivAtk,
        def: s.ivDef,
        spa: s.ivSpA,
        spd: s.ivSpD,
        spe: s.ivSpe,
      },
    };
  });

  // Run analyses
  const coverage = analyzeTypeCoverage(slots);
  const threats = await identifyThreats(slots, team.formatId);
  const synergyScore = calculateSynergy(slots);
  const speedTiers = calculateSpeedTiers(slots);
  const suggestions = generateSuggestions(coverage, threats, synergyScore, slots);

  return {
    coverage,
    threats,
    synergyScore,
    speedTiers,
    suggestions,
  };
}

function calculateSpeedTiers(slots: TeamSlotData[]): SpeedTierEntry[] {
  const entries: SpeedTierEntry[] = [];

  for (const slot of slots) {
    if (!slot.species) continue;

    const ivs = { ...DEFAULT_IVS, ...(slot.ivs ?? {}) } as typeof DEFAULT_IVS;
    const evs = { ...DEFAULT_EVS, ...(slot.evs ?? {}) } as typeof DEFAULT_EVS;
    const stats = calculateAllStats(
      slot.species.baseStats,
      ivs,
      evs,
      slot.level,
      slot.nature
    );

    entries.push({
      pokemonId: slot.pokemonId,
      pokemonName: slot.species.name,
      speed: stats.spe,
      nature: slot.nature,
      evs: slot.evs.spe,
    });
  }

  entries.sort((a, b) => b.speed - a.speed);
  return entries;
}

function generateSuggestions(
  coverage: TeamAnalysis["coverage"],
  threats: TeamAnalysis["threats"],
  synergyScore: number,
  slots: TeamSlotData[]
): string[] {
  const suggestions: string[] = [];

  // Coverage gaps
  if (coverage.uncoveredTypes.length > 0) {
    const typesList = coverage.uncoveredTypes.slice(0, 3).join(", ");
    suggestions.push(
      `Your team lacks super-effective coverage against ${typesList} types. Consider adding a Pokemon that can hit these types.`
    );
  }

  // Shared weaknesses
  if (coverage.sharedWeaknesses.length > 0) {
    for (const weakness of coverage.sharedWeaknesses.slice(0, 2)) {
      suggestions.push(
        `Multiple team members are weak to ${weakness}. Consider adding a Pokemon that resists ${weakness}.`
      );
    }
  }

  // High threats
  const highThreats = threats.filter((t) => t.threatLevel === "high");
  if (highThreats.length > 0) {
    const threatNames = highThreats.slice(0, 2).map((t) => t.pokemonName).join(" and ");
    suggestions.push(
      `${threatNames} ${highThreats.length === 1 ? "is a" : "are"} significant threat${highThreats.length === 1 ? "" : "s"}. Consider adding a check or counter.`
    );
  }

  // Synergy
  if (synergyScore < 40) {
    suggestions.push(
      "Team synergy is low. Consider Pokemon that complement each other's weaknesses and resistances."
    );
  }

  // Team size
  if (slots.length < 6) {
    suggestions.push(
      `Your team only has ${slots.length} Pokemon. Fill the remaining slots for a complete team.`
    );
  }

  return suggestions;
}
