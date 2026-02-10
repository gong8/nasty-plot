import type {
  Recommendation,
  TeamSlotData,
  PokemonType,
} from "@nasty-plot/core";
import { getUsageBasedRecommendations } from "./usage-recommender";
import { getCoverageBasedRecommendations } from "./coverage-recommender";
import { prisma } from "@nasty-plot/db";
import { Dex } from "@pkmn/dex";

interface CompositeWeights {
  usage: number;
  coverage: number;
}

const DEFAULT_WEIGHTS: CompositeWeights = {
  usage: 0.6,
  coverage: 0.4,
};

/**
 * Composite recommender that combines usage-based and coverage-based recommendations.
 */
export async function getRecommendations(
  teamId: string,
  limit: number = 10,
  weights: CompositeWeights = DEFAULT_WEIGHTS
): Promise<Recommendation[]> {
  // Load team from DB
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { slots: true },
  });

  if (!team) throw new Error(`Team not found: ${teamId}`);

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

  const teamPokemonIds = slots.map((s) => s.pokemonId);

  // Get both sets of recommendations
  const [usageRecs, coverageRecs] = await Promise.all([
    getUsageBasedRecommendations(teamPokemonIds, team.formatId, limit * 2),
    getCoverageBasedRecommendations(slots, team.formatId, limit * 2),
  ]);

  // Merge and weight
  const scoreMap = new Map<
    string,
    { pokemonName: string; usageScore: number; coverageScore: number; reasons: Recommendation["reasons"] }
  >();

  for (const rec of usageRecs) {
    const existing = scoreMap.get(rec.pokemonId) ?? {
      pokemonName: rec.pokemonName,
      usageScore: 0,
      coverageScore: 0,
      reasons: [],
    };
    existing.usageScore = rec.score;
    existing.reasons.push(...rec.reasons);
    scoreMap.set(rec.pokemonId, existing);
  }

  for (const rec of coverageRecs) {
    const existing = scoreMap.get(rec.pokemonId) ?? {
      pokemonName: rec.pokemonName,
      usageScore: 0,
      coverageScore: 0,
      reasons: [],
    };
    existing.coverageScore = rec.score;
    existing.reasons.push(...rec.reasons);
    scoreMap.set(rec.pokemonId, existing);
  }

  const combined: Recommendation[] = [];
  for (const [pokemonId, data] of scoreMap) {
    const compositeScore = Math.round(
      data.usageScore * weights.usage + data.coverageScore * weights.coverage
    );

    combined.push({
      pokemonId,
      pokemonName: data.pokemonName,
      score: Math.min(100, compositeScore),
      reasons: data.reasons,
    });
  }

  combined.sort((a, b) => b.score - a.score);
  return combined.slice(0, limit);
}
