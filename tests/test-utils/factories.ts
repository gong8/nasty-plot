import type {
  TeamSlotData,
  PokemonSpecies,
  PokemonType,
  StatsTable,
  TeamSlotInput,
  DamageCalcInput,
} from "@nasty-plot/core"
import {
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_LEVEL,
  MAX_SINGLE_EV,
  PERFECT_IV,
} from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const DEFAULT_STATS: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }

// ---------------------------------------------------------------------------
// Species factory
// ---------------------------------------------------------------------------

export function makeSpecies(
  id: string,
  types: PokemonType[],
  overrides?: Partial<PokemonSpecies>,
): PokemonSpecies {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    num: 1,
    types: types as PokemonSpecies["types"],
    baseStats: DEFAULT_STATS,
    abilities: { "0": "Ability" },
    weightkg: 50,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Slot factory (domain-level TeamSlotData with hydrated species)
// ---------------------------------------------------------------------------

export function makeSlot(
  pokemonId: string,
  types: [PokemonType] | [PokemonType, PokemonType],
  overrides?: Partial<TeamSlotData>,
): TeamSlotData {
  return {
    position: 1,
    pokemonId,
    species: {
      id: pokemonId,
      name: pokemonId.charAt(0).toUpperCase() + pokemonId.slice(1),
      num: 1,
      types,
      baseStats: DEFAULT_STATS,
      abilities: { "0": "Ability" },
      weightkg: 50,
    },
    ability: "Ability",
    item: "",
    nature: "Hardy",
    level: DEFAULT_LEVEL,
    moves: ["tackle", undefined, undefined, undefined],
    evs: DEFAULT_EVS,
    ivs: DEFAULT_IVS,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Slot input factory (for addSlot / updateSlot calls)
// ---------------------------------------------------------------------------

export function makeSlotInput(overrides?: Partial<TeamSlotInput>): TeamSlotInput {
  return {
    position: 1,
    pokemonId: "garchomp",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    level: DEFAULT_LEVEL,
    moves: ["Earthquake", "Dragon Claw", undefined, undefined],
    evs: { ...DEFAULT_EVS, atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV },
    ivs: DEFAULT_IVS,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// TeamData factory (API-level team shape)
// ---------------------------------------------------------------------------

export function makeTeamData(
  slots: unknown[] = [],
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    source: "manual",
    notes: undefined,
    isArchived: false,
    slots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// DB-level team factory (Prisma row shape)
// ---------------------------------------------------------------------------

export function makeDbTeam(overrides?: Record<string, unknown>) {
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

// ---------------------------------------------------------------------------
// DB-level slot factory (Prisma row shape with individual EV/IV columns)
// ---------------------------------------------------------------------------

export function makeDbSlot(overrides?: Record<string, unknown>) {
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
    evAtk: MAX_SINGLE_EV,
    evDef: 0,
    evSpA: 0,
    evSpD: 4,
    evSpe: MAX_SINGLE_EV,
    ivHp: PERFECT_IV,
    ivAtk: PERFECT_IV,
    ivDef: PERFECT_IV,
    ivSpA: PERFECT_IV,
    ivSpD: PERFECT_IV,
    ivSpe: PERFECT_IV,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Damage calc input factory
// ---------------------------------------------------------------------------

export function makeCalcInput(overrides?: Partial<DamageCalcInput>): DamageCalcInput {
  return {
    attacker: {
      pokemonId: "garchomp",
      level: DEFAULT_LEVEL,
      nature: "Jolly",
      ability: "Rough Skin",
      evs: { hp: 0, atk: MAX_SINGLE_EV, def: 0, spa: 0, spd: 4, spe: MAX_SINGLE_EV },
    },
    defender: {
      pokemonId: "heatran",
      level: DEFAULT_LEVEL,
    },
    move: "Earthquake",
    ...overrides,
  }
}
