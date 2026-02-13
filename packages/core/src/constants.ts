import type { NatureData, NatureName, PokemonType, StatName, StatsTable } from "./types"

// --- Nature Data ---

export const NATURE_DATA: Record<NatureName, NatureData> = {
  Adamant: { name: "Adamant", plus: "atk", minus: "spa" },
  Bashful: { name: "Bashful" },
  Bold: { name: "Bold", plus: "def", minus: "atk" },
  Brave: { name: "Brave", plus: "atk", minus: "spe" },
  Calm: { name: "Calm", plus: "spd", minus: "atk" },
  Careful: { name: "Careful", plus: "spd", minus: "spa" },
  Docile: { name: "Docile" },
  Gentle: { name: "Gentle", plus: "spd", minus: "def" },
  Hardy: { name: "Hardy" },
  Hasty: { name: "Hasty", plus: "spe", minus: "def" },
  Impish: { name: "Impish", plus: "def", minus: "spa" },
  Jolly: { name: "Jolly", plus: "spe", minus: "spa" },
  Lax: { name: "Lax", plus: "def", minus: "spd" },
  Lonely: { name: "Lonely", plus: "atk", minus: "def" },
  Mild: { name: "Mild", plus: "spa", minus: "def" },
  Modest: { name: "Modest", plus: "spa", minus: "atk" },
  Naive: { name: "Naive", plus: "spe", minus: "spd" },
  Naughty: { name: "Naughty", plus: "atk", minus: "spd" },
  Quiet: { name: "Quiet", plus: "spa", minus: "spe" },
  Quirky: { name: "Quirky" },
  Rash: { name: "Rash", plus: "spa", minus: "spd" },
  Relaxed: { name: "Relaxed", plus: "def", minus: "spe" },
  Sassy: { name: "Sassy", plus: "spd", minus: "spe" },
  Serious: { name: "Serious" },
  Timid: { name: "Timid", plus: "spe", minus: "atk" },
}

// --- Type Colors (for badges/UI) ---

export const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "#A8A878",
  Fire: "#F08030",
  Water: "#6890F0",
  Electric: "#F8D030",
  Grass: "#78C850",
  Ice: "#98D8D8",
  Fighting: "#C03028",
  Poison: "#A040A0",
  Ground: "#E0C068",
  Flying: "#A890F0",
  Psychic: "#F85888",
  Bug: "#A8B820",
  Rock: "#B8A038",
  Ghost: "#705898",
  Dragon: "#7038F8",
  Dark: "#705848",
  Steel: "#B8B8D0",
  Fairy: "#EE99AC",
}

/** Returns true if the hex color is light enough to need dark text */
export function isLightTypeColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55
}

// --- Type Chart (effectiveness multipliers) ---
// TYPE_CHART[attacking][defending] = multiplier

export const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Poison: 0.5,
    Ground: 2,
    Flying: 0.5,
    Bug: 0.5,
    Rock: 2,
    Dragon: 0.5,
    Steel: 0.5,
  },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: {
    Normal: 2,
    Ice: 2,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Rock: 2,
    Ghost: 0,
    Dark: 2,
    Steel: 2,
    Fairy: 0.5,
  },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: {
    Fire: 0.5,
    Grass: 2,
    Fighting: 0.5,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 2,
    Ghost: 0.5,
    Dark: 2,
    Steel: 0.5,
    Fairy: 0.5,
  },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Poison: 0.5, Fighting: 2, Dragon: 2, Dark: 2, Steel: 0.5 },
}

// --- Stat Display Names ---

export const STAT_LABELS: Record<StatName, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
}

export const STAT_COLORS: Record<StatName, string> = {
  hp: "#FF5959",
  atk: "#F5AC78",
  def: "#FAE078",
  spa: "#9DB7F5",
  spd: "#A7DB8D",
  spe: "#FA92B2",
}

// --- Defaults ---

export const DEFAULT_ABILITY = ""
export const DEFAULT_ITEM = ""
export const DEFAULT_NATURE = "Hardy" as const
export const DEFAULT_API_URL = "http://localhost:3000"

// --- Team Size ---

export const TEAM_SIZE = 6

// --- EV/IV Limits ---

export const MAX_TOTAL_EVS = 510
export const MAX_SINGLE_EV = 252
export const PERFECT_IV = 31

// --- Default IVs/EVs ---

export const DEFAULT_IVS: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
export const DEFAULT_EVS: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

// --- Level Defaults ---

export const DEFAULT_LEVEL = 100
export const VGC_LEVEL = 50
export const LC_LEVEL = 5

// --- Format Defaults ---

export const DEFAULT_FORMAT_ID = "gen9ou"

// --- Game Constants (Weathers, Terrains, Statuses, Boosts) ---

export const WEATHERS = [
  "None",
  "Sun",
  "Rain",
  "Sand",
  "Snow",
  "Harsh Sunshine",
  "Heavy Rain",
  "Strong Winds",
] as const

export const TERRAINS = ["None", "Electric", "Grassy", "Misty", "Psychic"] as const

export const STATUSES = [
  "None",
  "Healthy",
  "Burned",
  "Paralyzed",
  "Poisoned",
  "Badly Poisoned",
  "Asleep",
  "Frozen",
] as const

export const BOOST_VALUES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6] as const

// --- Archetype Options ---

export const ARCHETYPE_OPTIONS = [
  { value: "all", label: "All Archetypes" },
  { value: "hyper-offense", label: "Hyper Offense" },
  { value: "offense", label: "Offense" },
  { value: "balance", label: "Balance" },
  { value: "bulky-offense", label: "Bulky Offense" },
  { value: "stall", label: "Stall" },
  { value: "rain", label: "Rain" },
  { value: "sun", label: "Sun" },
  { value: "sand", label: "Sand" },
  { value: "trick-room", label: "Trick Room" },
] as const

// --- Unified Status Data ---

export type CalcStatusName = "slp" | "psn" | "brn" | "frz" | "par" | "tox"

export interface StatusEntry {
  label: string
  displayName: string
  calcName: CalcStatusName
  color: string
  protocolMessage: string
}

export const STATUS_DATA: Record<CalcStatusName, StatusEntry> = {
  brn: {
    label: "BRN",
    displayName: "Burned",
    calcName: "brn",
    color: "bg-red-500",
    protocolMessage: "burned",
  },
  par: {
    label: "PAR",
    displayName: "Paralyzed",
    calcName: "par",
    color: "bg-yellow-500",
    protocolMessage: "paralyzed",
  },
  slp: {
    label: "SLP",
    displayName: "Asleep",
    calcName: "slp",
    color: "bg-gray-500",
    protocolMessage: "fell asleep",
  },
  frz: {
    label: "FRZ",
    displayName: "Frozen",
    calcName: "frz",
    color: "bg-cyan-400",
    protocolMessage: "was frozen",
  },
  psn: {
    label: "PSN",
    displayName: "Poisoned",
    calcName: "psn",
    color: "bg-purple-500",
    protocolMessage: "was poisoned",
  },
  tox: {
    label: "TOX",
    displayName: "Badly Poisoned",
    calcName: "tox",
    color: "bg-purple-600",
    protocolMessage: "was badly poisoned",
  },
}

export const STATUS_CALC_MAP: Record<string, CalcStatusName> = Object.fromEntries(
  Object.values(STATUS_DATA).map((s) => [s.displayName, s.calcName]),
) as Record<string, CalcStatusName>

export const STATUS_DISPLAY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_DATA).map(([abbr, s]) => [abbr, s.protocolMessage]),
) as Record<string, string>

export const STATUS_BADGE_CONFIG: Record<string, { label: string; color: string }> =
  Object.fromEntries(
    Object.entries(STATUS_DATA).map(([abbr, s]) => [abbr, { label: s.label, color: s.color }]),
  ) as Record<string, { label: string; color: string }>
