import type { PokemonType, StatsTable } from "@nasty-plot/core";

export interface PredictedSet {
  pokemonId: string;
  predictedMoves: string[];
  predictedItem?: string;
  predictedAbility?: string;
  confidence: number;
}

export type BattlePhase = "setup" | "preview" | "battle" | "ended";
export type BattleFormat = "singles" | "doubles";
export type AIDifficulty = "random" | "greedy" | "heuristic" | "expert";

export type StatusCondition =
  | "brn"
  | "par"
  | "slp"
  | "frz"
  | "psn"
  | "tox"
  | "";

export type Weather = "Sun" | "Rain" | "Sand" | "Snow" | "Desolate Land" | "Primordial Sea" | "Delta Stream" | "";
export type Terrain = "Electric" | "Grassy" | "Misty" | "Psychic" | "";

export interface BoostTable {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  accuracy: number;
  evasion: number;
}

export interface BattlePokemon {
  /** Species identifier (e.g. "Garchomp") */
  speciesId: string;
  name: string;
  /** Player-given nickname, falls back to species name */
  nickname: string;
  level: number;
  types: PokemonType[];
  hp: number;
  maxHp: number;
  /** 0-100 percentage */
  hpPercent: number;
  status: StatusCondition;
  fainted: boolean;
  item: string;
  ability: string;
  teraType?: PokemonType;
  isTerastallized: boolean;
  moves: BattleMove[];
  stats: StatsTable;
  boosts: BoostTable;
  /** Volatile conditions like confusion, leech seed, substitute, etc. */
  volatiles: string[];
}

export interface BattleMove {
  id: string;
  name: string;
  pp: number;
  maxPp: number;
  type: PokemonType;
  disabled: boolean;
  target: string;
}

export interface SideConditions {
  stealthRock: boolean;
  spikes: number; // 0-3 layers
  toxicSpikes: number; // 0-2 layers
  stickyWeb: boolean;
  reflect: number; // turns remaining, 0 = not active
  lightScreen: number;
  auroraVeil: number;
  tailwind: number;
}

export interface FieldState {
  weather: Weather;
  weatherTurns: number;
  terrain: Terrain;
  terrainTurns: number;
  trickRoom: number; // turns remaining
}

export interface BattleSide {
  /** Currently active Pokemon (1 for singles, 2 for doubles) */
  active: (BattlePokemon | null)[];
  /** All team Pokemon including active (for tracking bench) */
  team: BattlePokemon[];
  /** Player name */
  name: string;
  sideConditions: SideConditions;
  /** Whether this side can terastallize */
  canTera: boolean;
  /** Whether this side has already terastallized (persistent, unlike canTera which resets from requests) */
  hasTerastallized: boolean;
}

export interface BattleState {
  phase: BattlePhase;
  format: BattleFormat;
  turn: number;
  /** p1 = player, p2 = opponent (AI) */
  sides: {
    p1: BattleSide;
    p2: BattleSide;
  };
  field: FieldState;
  winner: "p1" | "p2" | null;
  /** Log of battle events for the current turn */
  log: BattleLogEntry[];
  /** Full log of all events */
  fullLog: BattleLogEntry[];
  /** Whether waiting for player input */
  waitingForChoice: boolean;
  /** Available actions for the player */
  availableActions: BattleActionSet | null;
  /** Unique battle ID */
  id: string;
  /** Predicted opponent sets from SetPredictor */
  opponentPredictions?: Record<string, PredictedSet>;
}

export interface MoveAction {
  type: "move";
  moveIndex: number; // 1-indexed as @pkmn/sim uses
  /** For doubles: which target slot */
  targetSlot?: number;
  /** Whether to terastallize this turn */
  tera?: boolean;
  /** Whether to mega evolve */
  mega?: boolean;
}

export interface SwitchAction {
  type: "switch";
  /** 1-indexed Pokemon slot in team */
  pokemonIndex: number;
}

export type BattleAction = MoveAction | SwitchAction;

export interface BattleActionSet {
  /** Available move choices */
  moves: {
    name: string;
    id: string;
    pp: number;
    maxPp: number;
    type: PokemonType;
    disabled: boolean;
    target: string;
    basePower: number;
    category: "Physical" | "Special" | "Status";
    accuracy: number | true;
    description: string;
  }[];
  /** Whether tera is available */
  canTera: boolean;
  /** Available switch targets (1-indexed team positions) */
  switches: {
    index: number;
    name: string;
    speciesId: string;
    hp: number;
    maxHp: number;
    status: StatusCondition;
    fainted: boolean;
  }[];
  /** Whether this is a forced switch (after KO) */
  forceSwitch: boolean;
  /** For doubles: which active slot this choice is for (0 or 1) */
  activeSlot?: number;
}

export type BattleLogType =
  | "move"
  | "damage"
  | "heal"
  | "status"
  | "boost"
  | "unboost"
  | "switch"
  | "faint"
  | "weather"
  | "terrain"
  | "hazard"
  | "screen"
  | "item"
  | "ability"
  | "tera"
  | "turn"
  | "win"
  | "info"
  | "start"
  | "end"
  | "cant"
  | "crit"
  | "supereffective"
  | "resisted"
  | "immune";

export interface BattleLogEntry {
  type: BattleLogType;
  message: string;
  turn: number;
  /** Which side this pertains to, if any */
  side?: "p1" | "p2";
  /** Additional structured data */
  data?: Record<string, unknown>;
}

export interface BattleSetupConfig {
  formatId: string;
  gameType: BattleFormat;
  playerTeamId: string;
  opponentTeamPaste: string;
  aiDifficulty: AIDifficulty;
  /** Player name */
  playerName: string;
  opponentName: string;
}

export interface AIPlayer {
  readonly difficulty: AIDifficulty;
  chooseAction(
    state: BattleState,
    actions: BattleActionSet
  ): Promise<BattleAction>;
  chooseLeads(teamSize: number, gameType: BattleFormat): number[];
}
