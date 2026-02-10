// ============================
// Core Domain Types - The Backbone
// ============================

// --- Pokemon Types ---

export const POKEMON_TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
  "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
  "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export type StatName = (typeof STATS)[number];

export type StatsTable = Record<StatName, number>;

export interface PokemonSpecies {
  id: string;        // e.g. "greatTusk" (dex ID format)
  name: string;      // e.g. "Great Tusk"
  num: number;       // National dex number
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: StatsTable;
  abilities: { [slot: string]: string }; // "0": "Protosynthesis"
  weightkg: number;
  tier?: string;
  isNonstandard?: string | null; // null = SV-native, "Past" = old-gen
}

export interface MoveData {
  id: string;
  name: string;
  type: PokemonType;
  category: "Physical" | "Special" | "Status";
  basePower: number;
  accuracy: number | true; // true = never misses
  pp: number;
  priority: number;
  target: string;
  flags: Record<string, number>;
  description?: string;
  isNonstandard?: string | null; // null = SV-native, "Past" = old-gen
}

export interface AbilityData {
  id: string;
  name: string;
  description?: string;
}

export interface ItemData {
  id: string;
  name: string;
  description?: string;
  isNonstandard?: string | null; // null = SV-native, "Past" = old-gen
}

// --- Nature ---

export const NATURES = [
  "Adamant", "Bashful", "Bold", "Brave", "Calm",
  "Careful", "Docile", "Gentle", "Hardy", "Hasty",
  "Impish", "Jolly", "Lax", "Lonely", "Mild",
  "Modest", "Naive", "Naughty", "Quiet", "Quirky",
  "Rash", "Relaxed", "Sassy", "Serious", "Timid",
] as const;

export type NatureName = (typeof NATURES)[number];

export interface NatureData {
  name: NatureName;
  plus?: StatName;
  minus?: StatName;
}

// --- Format ---

export type GameType = "singles" | "doubles";
export type DexScope = "sv" | "natdex";

export interface FormatDefinition {
  id: string;            // e.g. "gen9ou"
  name: string;          // e.g. "OU"
  generation: number;
  gameType: GameType;
  dexScope: DexScope;
  teamSize: number;
  minLevel?: number;
  maxLevel: number;
  defaultLevel: number;
  rules: string[];       // e.g. ["Species Clause", "Sleep Clause"]
  bans: string[];        // e.g. ["Flutter Mane", "Kyogre"]
  restricted?: string[]; // For VGC restricted formats
  isActive: boolean;
}

// --- Team Building ---

export interface TeamSlotData {
  position: number;     // 1-6
  pokemonId: string;
  nickname?: string;
  species?: PokemonSpecies; // Hydrated from dex
  ability: string;
  item: string;
  nature: NatureName;
  teraType?: PokemonType;
  level: number;
  moves: [string, string?, string?, string?];
  evs: StatsTable;
  ivs: StatsTable;
  calculatedStats?: StatsTable; // Computed on the fly
}

export interface TeamData {
  id: string;
  name: string;
  formatId: string;
  format?: FormatDefinition;
  mode: "freeform" | "guided";
  notes?: string;
  slots: TeamSlotData[];
  createdAt: string;
  updatedAt: string;
}

export type TeamCreateInput = {
  name: string;
  formatId: string;
  mode?: "freeform" | "guided";
  notes?: string;
};

export type TeamSlotInput = Omit<TeamSlotData, "species" | "calculatedStats">;

// --- Competitive Data ---

export interface UsageStatsEntry {
  pokemonId: string;
  pokemonName?: string;
  types?: PokemonType[];
  num?: number;
  usagePercent: number;
  rank: number;
}

export interface SmogonSetData {
  pokemonId: string;
  setName: string;
  ability: string;
  item: string;
  nature: NatureName;
  teraType?: PokemonType;
  moves: (string | string[])[]; // string = fixed, string[] = slash options
  evs: Partial<StatsTable>;
  ivs?: Partial<StatsTable>;
}

export interface TeammateCorrelation {
  pokemonId: string;
  pokemonName?: string;
  correlationPercent: number;
}

export interface CheckCounterData {
  counterId: string;
  counterName?: string;
  koPercent: number;
  switchPercent: number;
}

// --- Damage Calc ---

export interface DamageCalcInput {
  attacker: {
    pokemonId: string;
    level: number;
    ability?: string;
    item?: string;
    nature?: NatureName;
    evs?: Partial<StatsTable>;
    ivs?: Partial<StatsTable>;
    boosts?: Partial<StatsTable>;
    teraType?: PokemonType;
    status?: string;
  };
  defender: {
    pokemonId: string;
    level: number;
    ability?: string;
    item?: string;
    nature?: NatureName;
    evs?: Partial<StatsTable>;
    ivs?: Partial<StatsTable>;
    boosts?: Partial<StatsTable>;
    teraType?: PokemonType;
    status?: string;
  };
  move: string;
  field?: {
    weather?: string;
    terrain?: string;
    isReflect?: boolean;
    isLightScreen?: boolean;
    isAuroraVeil?: boolean;
    isCritical?: boolean;
    isDoubles?: boolean;
  };
}

export interface DamageCalcResult {
  moveName: string;
  damage: number[];       // Array of possible damage values (16 rolls)
  minPercent: number;
  maxPercent: number;
  minDamage: number;
  maxDamage: number;
  koChance: string;       // e.g. "guaranteed 2HKO"
  description: string;    // Full calc description line
}

export interface MatchupMatrixEntry {
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  bestMove: string;
  maxPercent: number;
  koChance: string;
}

// --- Analysis ---

export interface TypeCoverage {
  offensive: Record<PokemonType, number>; // How many types we can hit super-effectively
  defensive: Record<PokemonType, number>; // How many resists/immunities we have
  uncoveredTypes: PokemonType[];
  sharedWeaknesses: PokemonType[];
}

export interface TeamAnalysis {
  coverage: TypeCoverage;
  threats: ThreatEntry[];
  synergyScore: number;
  speedTiers: SpeedTierEntry[];
  suggestions: string[];
}

export interface ThreatEntry {
  pokemonId: string;
  pokemonName: string;
  usagePercent: number;
  threatLevel: "high" | "medium" | "low";
  reason: string;
}

export interface SpeedTierEntry {
  pokemonId: string;
  pokemonName: string;
  speed: number;
  nature: string;
  evs: number;
  boosted?: boolean;
}

// --- Recommendations ---

export interface Recommendation {
  pokemonId: string;
  pokemonName: string;
  score: number;         // 0-100 composite score
  reasons: RecommendationReason[];
  suggestedSet?: SmogonSetData;
}

export interface RecommendationReason {
  type: "usage" | "coverage" | "synergy" | "meta";
  description: string;
  weight: number;
}

// --- LLM / Chat ---

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id?: number;
  role: ChatRole;
  content: string;
  toolCalls?: Record<string, unknown>[];
  createdAt?: string;
}

export interface ChatSessionData {
  id: string;
  teamId?: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// --- API Response Wrappers ---

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  error: string;
  code: string;
  suggestion?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
