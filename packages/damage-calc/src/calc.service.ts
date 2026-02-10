import { Generations } from "@pkmn/data";
import { Dex } from "@pkmn/dex";
import {
  calculate,
  Pokemon,
  Move,
  Field,
  Side,
} from "@smogon/calc";
import type {
  DamageCalcInput,
  DamageCalcResult,
  MatchupMatrixEntry,
  TeamSlotData,
  StatsTable,
} from "@nasty-plot/core";

const gens = new Generations(Dex);
const gen = gens.get(9);

function toCalcEvs(evs?: Partial<StatsTable>) {
  return {
    hp: evs?.hp ?? 0,
    atk: evs?.atk ?? 0,
    def: evs?.def ?? 0,
    spa: evs?.spa ?? 0,
    spd: evs?.spd ?? 0,
    spe: evs?.spe ?? 0,
  };
}

function toCalcIvs(ivs?: Partial<StatsTable>) {
  return {
    hp: ivs?.hp ?? 31,
    atk: ivs?.atk ?? 31,
    def: ivs?.def ?? 31,
    spa: ivs?.spa ?? 31,
    spd: ivs?.spd ?? 31,
    spe: ivs?.spe ?? 31,
  };
}

function toCalcBoosts(boosts?: Partial<StatsTable>) {
  if (!boosts) return undefined;
  return {
    atk: boosts.atk ?? 0,
    def: boosts.def ?? 0,
    spa: boosts.spa ?? 0,
    spd: boosts.spd ?? 0,
    spe: boosts.spe ?? 0,
  };
}

/**
 * Resolve a pokemonId to a display name usable by @smogon/calc.
 * pokemonId is in camelCase (e.g. "greatTusk"), we need "Great Tusk".
 * We try the @pkmn/dex lookup first, falling back to naive conversion.
 */
type CalcStatusName = "slp" | "psn" | "brn" | "frz" | "par" | "tox";

const STATUS_MAP: Record<string, CalcStatusName> = {
  "Burned": "brn",
  "Paralyzed": "par",
  "Poisoned": "psn",
  "Badly Poisoned": "tox",
  "Asleep": "slp",
  "Frozen": "frz",
};

function toCalcStatus(status?: string): CalcStatusName | "" | undefined {
  if (!status || status === "None" || status === "Healthy") return undefined;
  return STATUS_MAP[status] ?? undefined;
}

function resolveSpeciesName(pokemonId: string): string {
  // Try direct dex lookup
  const species = Dex.species.get(pokemonId);
  if (species?.exists) return species.name;
  // Fallback: split camelCase and capitalize
  return pokemonId
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}

function flattenDamage(damage: number | number[] | number[][]): number[] {
  if (typeof damage === "number") return [damage];
  if (Array.isArray(damage) && damage.length > 0) {
    if (Array.isArray(damage[0])) {
      // number[][] (doubles spread moves) — flatten first sub-array
      return (damage as number[][])[0];
    }
    return damage as number[];
  }
  return [0];
}

function deriveKoChance(damageArr: number[], defenderHp: number): string {
  if (defenderHp <= 0) return "N/A";
  const minDmg = Math.min(...damageArr);
  const maxDmg = Math.max(...damageArr);

  if (minDmg >= defenderHp) return "guaranteed OHKO";
  if (maxDmg >= defenderHp) return "possible OHKO";

  // Check 2HKO through 4HKO
  for (const n of [2, 3, 4]) {
    if (minDmg * n >= defenderHp) return `guaranteed ${n}HKO`;
    if (maxDmg * n >= defenderHp) return `possible ${n}HKO`;
  }

  return "5+ hits to KO";
}

export function calculateDamage(input: DamageCalcInput): DamageCalcResult {
  const attackerName = resolveSpeciesName(input.attacker.pokemonId);
  const defenderName = resolveSpeciesName(input.defender.pokemonId);

  const attacker = new Pokemon(gen, attackerName, {
    level: input.attacker.level,
    ability: input.attacker.ability || undefined,
    item: input.attacker.item || undefined,
    nature: input.attacker.nature || "Hardy",
    evs: toCalcEvs(input.attacker.evs),
    ivs: toCalcIvs(input.attacker.ivs),
    boosts: toCalcBoosts(input.attacker.boosts),
    teraType: input.attacker.teraType || undefined,
    status: toCalcStatus(input.attacker.status),
  });

  const defender = new Pokemon(gen, defenderName, {
    level: input.defender.level,
    ability: input.defender.ability || undefined,
    item: input.defender.item || undefined,
    nature: input.defender.nature || "Hardy",
    evs: toCalcEvs(input.defender.evs),
    ivs: toCalcIvs(input.defender.ivs),
    boosts: toCalcBoosts(input.defender.boosts),
    teraType: input.defender.teraType || undefined,
    status: toCalcStatus(input.defender.status),
  });

  const move = new Move(gen, input.move);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldOptions: Record<string, any> = {};
  if (input.field) {
    if (input.field.weather) fieldOptions.weather = input.field.weather;
    if (input.field.terrain) fieldOptions.terrain = input.field.terrain;
    if (input.field.isCritical) move.isCrit = true;
    if (input.field.isDoubles) fieldOptions.gameType = "Doubles";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attackerSideOptions: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defenderSideOptions: Record<string, any> = {};

    if (input.field.isReflect) defenderSideOptions.isReflect = true;
    if (input.field.isLightScreen) defenderSideOptions.isLightScreen = true;
    if (input.field.isAuroraVeil) defenderSideOptions.isAuroraVeil = true;

    fieldOptions.attackerSide = attackerSideOptions;
    fieldOptions.defenderSide = defenderSideOptions;
  }

  const field = new Field(fieldOptions);
  const result = calculate(gen, attacker, defender, move, field);

  const damageArr = flattenDamage(result.damage);
  const defenderHp = defender.maxHP();
  const minDamage = Math.min(...damageArr);
  const maxDamage = Math.max(...damageArr);
  const minPercent = defenderHp > 0 ? Math.round((minDamage / defenderHp) * 1000) / 10 : 0;
  const maxPercent = defenderHp > 0 ? Math.round((maxDamage / defenderHp) * 1000) / 10 : 0;

  let description: string;
  try {
    description = result.desc();
  } catch {
    description = `${attackerName} ${input.move} vs ${defenderName}: ${minPercent}-${maxPercent}%`;
  }

  const koChance = deriveKoChance(damageArr, defenderHp);

  return {
    moveName: input.move,
    damage: damageArr,
    minPercent,
    maxPercent,
    minDamage,
    maxDamage,
    koChance,
    description,
  };
}

export function calculateMatchupMatrix(
  teamSlots: TeamSlotData[],
  threatIds: string[],
  _formatId: string
): MatchupMatrixEntry[][] {
  const matrix: MatchupMatrixEntry[][] = [];

  for (const slot of teamSlots) {
    const row: MatchupMatrixEntry[] = [];
    for (const threatId of threatIds) {
      const moves = slot.moves.filter(Boolean) as string[];
      let bestEntry: MatchupMatrixEntry = {
        attackerId: slot.pokemonId,
        attackerName: slot.species?.name ?? resolveSpeciesName(slot.pokemonId),
        defenderId: threatId,
        defenderName: resolveSpeciesName(threatId),
        bestMove: moves[0] ?? "Struggle",
        maxPercent: 0,
        koChance: "N/A",
      };

      for (const moveName of moves) {
        try {
          const result = calculateDamage({
            attacker: {
              pokemonId: slot.pokemonId,
              level: slot.level,
              ability: slot.ability,
              item: slot.item,
              nature: slot.nature,
              evs: slot.evs,
              ivs: slot.ivs,
            },
            defender: {
              pokemonId: threatId,
              level: 100,
            },
            move: moveName,
          });

          if (result.maxPercent > bestEntry.maxPercent) {
            bestEntry = {
              ...bestEntry,
              bestMove: moveName,
              maxPercent: result.maxPercent,
              koChance: result.koChance,
            };
          }
        } catch {
          // Skip moves that fail to calculate (status moves, etc.)
        }
      }

      row.push(bestEntry);
    }
    matrix.push(row);
  }

  return matrix;
}
