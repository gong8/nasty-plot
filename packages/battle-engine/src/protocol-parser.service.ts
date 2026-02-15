import { getRawMove } from "@nasty-plot/pokemon-data"
import {
  DEFAULT_EVS,
  DEFAULT_LEVEL,
  POKEMON_TYPES,
  STATUS_DISPLAY_MAP,
  camelCaseToDisplayName,
  toId,
  type MoveCategory,
  type PokemonType,
} from "@nasty-plot/core"
import {
  calcHpPercent,
  defaultBoosts,
  type BattleState,
  type BattlePokemon,
  type BattleLogEntry,
  type BattleLogType,
  type BattleActionSet,
  type StatusCondition,
  type Weather,
  type Terrain,
  type BoostTable,
  type SideConditions,
} from "./types"

/**
 * Protocol Parser
 *
 * Parses @pkmn/sim protocol messages into BattleState mutations.
 * Protocol reference: https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md
 */

type Side = "p1" | "p2"

// --- Type guards for runtime validation of protocol values ---

const STATUS_CONDITIONS = new Set<string>(["brn", "par", "slp", "frz", "psn", "tox"])

function isStatusCondition(s: string): s is StatusCondition {
  return s === "" || STATUS_CONDITIONS.has(s)
}

const POKEMON_TYPE_SET = new Set<string>(POKEMON_TYPES)

function isPokemonType(s: string): s is PokemonType {
  return POKEMON_TYPE_SET.has(s)
}

function isSide(s: string): s is Side {
  return s === "p1" || s === "p2"
}

const BOOST_STATS = new Set<string>(["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"])

function isBoostStat(s: string): s is keyof BoostTable {
  return BOOST_STATS.has(s)
}

const BOOST_STAT_NAMES: Record<string, string> = {
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
}

const STAT_BOOST_ABILITIES = ["quarkdrive", "protosynthesis"] as const

const WEATHER_MAP: Record<string, Weather> = {
  Sandstorm: "Sand",
  SunnyDay: "Sun",
  RainDance: "Rain",
  Snow: "Snow",
  Hail: "Snow",
  DesolateLand: "Desolate Land",
  PrimordialSea: "Primordial Sea",
  DeltaStream: "Delta Stream",
}

const TERRAIN_MAP: Record<string, Terrain> = {
  "Electric Terrain": "Electric",
  "Grassy Terrain": "Grassy",
  "Misty Terrain": "Misty",
  "Psychic Terrain": "Psychic",
}

const EFFECTIVENESS_MESSAGES: Record<string, { type: BattleLogType; msg: string }> = {
  "-crit": { type: "crit", msg: "A critical hit!" },
  "-supereffective": { type: "supereffective", msg: "It's super effective!" },
  "-resisted": { type: "resisted", msg: "It's not very effective..." },
  "-immune": { type: "immune", msg: "It had no effect!" },
}

const SWITCH_VERBS: Record<string, string> = {
  switch: "sent out",
  drag: "was dragged out",
  replace: "appeared",
}

const SIDE_CONDITION_HANDLERS: Record<
  string,
  { set: (sc: SideConditions) => void; clear: (sc: SideConditions) => void }
> = {
  "Stealth Rock": {
    set: (sc) => {
      sc.stealthRock = true
    },
    clear: (sc) => {
      sc.stealthRock = false
    },
  },
  Spikes: {
    set: (sc) => {
      sc.spikes = Math.min(3, sc.spikes + 1)
    },
    clear: (sc) => {
      sc.spikes = 0
    },
  },
  "Toxic Spikes": {
    set: (sc) => {
      sc.toxicSpikes = Math.min(2, sc.toxicSpikes + 1)
    },
    clear: (sc) => {
      sc.toxicSpikes = 0
    },
  },
  "Sticky Web": {
    set: (sc) => {
      sc.stickyWeb = true
    },
    clear: (sc) => {
      sc.stickyWeb = false
    },
  },
  Reflect: {
    set: (sc) => {
      sc.reflect = 5
    },
    clear: (sc) => {
      sc.reflect = 0
    },
  },
  "Light Screen": {
    set: (sc) => {
      sc.lightScreen = 5
    },
    clear: (sc) => {
      sc.lightScreen = 0
    },
  },
  "Aurora Veil": {
    set: (sc) => {
      sc.auroraVeil = 5
    },
    clear: (sc) => {
      sc.auroraVeil = 0
    },
  },
  Tailwind: {
    set: (sc) => {
      sc.tailwind = 4
    },
    clear: (sc) => {
      sc.tailwind = 0
    },
  },
}

/** Parse "quarkdrivespe" -> { ability: "Quark Drive", stat: "Speed" } or null */
function parseStatBoostCondition(condition: string): { ability: string; stat: string } | null {
  const lower = condition.toLowerCase()
  for (const prefix of STAT_BOOST_ABILITIES) {
    if (lower.startsWith(prefix)) {
      const statKey = lower.slice(prefix.length)
      const statName = BOOST_STAT_NAMES[statKey]
      if (statName) {
        const abilityName = prefix === "quarkdrive" ? "Quark Drive" : "Protosynthesis"
        return { ability: abilityName, stat: statName }
      }
    }
  }
  return null
}

/** Parse "p1a: Garchomp" -> { side: "p1", slot: "a", name: "Garchomp" } */
function parsePokemonIdent(ident: string): { side: Side; slot: string; name: string } | null {
  const match = ident.match(/^(p[12])([a-d]?):\s*(.+)$/)
  if (!match || !isSide(match[1])) return null
  return {
    side: match[1],
    slot: match[2] || "a",
    name: match[3].trim(),
  }
}

/** Parse "100/319" -> { hp: 100, maxHp: 319 } or percentage like "78/100" */
function parseHp(hpStr: string): { hp: number; maxHp: number } {
  if (hpStr === "0 fnt") return { hp: 0, maxHp: 0 }
  const parts = hpStr.split(" ")[0] // Strip conditions like "100/319 par"
  const [hp, maxHp] = parts.split("/").map(Number)
  return { hp: hp || 0, maxHp: maxHp || 0 }
}

/** Parse status from HP string like "100/319 par" */
function parseStatusFromHp(hpStr: string): StatusCondition {
  const parts = hpStr.split(" ")
  if (parts.length > 1 && isStatusCondition(parts[1])) {
    return parts[1]
  }
  return ""
}

/** Parse "Garchomp, L100, M" -> species details */
function parseDetails(details: string): { species: string; level: number; gender: string } {
  const parts = details.split(",").map((s) => s.trim())
  const species = parts[0]
  let level = DEFAULT_LEVEL
  let gender = ""

  for (let i = 1; i < parts.length; i++) {
    if (parts[i].startsWith("L")) {
      level = parseInt(parts[i].slice(1), 10)
    } else if (parts[i] === "M" || parts[i] === "F") {
      gender = parts[i]
    }
  }

  return { species, level, gender }
}

/** Slot letter to 0-based index */
function slotIndex(slot: string): number {
  return slot.charCodeAt(0) - "a".charCodeAt(0)
}

function makeEmptyPokemon(): BattlePokemon {
  return {
    pokemonId: "",
    name: "",
    nickname: "",
    level: DEFAULT_LEVEL,
    types: [],
    hp: 0,
    maxHp: 0,
    hpPercent: 0,
    status: "",
    fainted: false,
    item: "",
    ability: "",
    isTerastallized: false,
    moves: [],
    stats: { ...DEFAULT_EVS },
    boosts: defaultBoosts(),
    volatiles: [],
  }
}

/**
 * Apply HP data to a pokemon, only increasing maxHp to avoid
 * corruption from percentage-format HP in opponent's perspective.
 */
function applyHpUpdate(
  pokemon: BattlePokemon,
  hpData: { hp: number; maxHp: number },
  status?: StatusCondition,
) {
  pokemon.hp = hpData.hp
  if (hpData.maxHp > pokemon.maxHp) pokemon.maxHp = hpData.maxHp
  pokemon.hpPercent = calcHpPercent(pokemon.hp, pokemon.maxHp)
  if (status) pokemon.status = status
  pokemon.fainted = pokemon.hp === 0
}

/**
 * Find a Pokemon on a side by nickname (search active first, then team).
 */
function findPokemon(state: BattleState, side: Side, name: string): BattlePokemon | null {
  const s = state.sides[side]
  // Check active
  for (const p of s.active) {
    if (p && (p.nickname === name || p.name === name)) return p
  }
  // Check team
  for (const p of s.team) {
    if (p.nickname === name || p.name === name) return p
  }
  return null
}

// --- Protocol command handlers (extracted from processLine for readability) ---

function handleSwitch(state: BattleState, cmd: string, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const details = parseDetails(args[1])
  const hpData = args[2] ? parseHp(args[2]) : { hp: 100, maxHp: 100 }
  const status = args[2] ? parseStatusFromHp(args[2]) : ""

  const side = state.sides[ident.side]
  const idx = slotIndex(ident.slot)

  let pokemon = side.team.find((p) => p.name === details.species || p.nickname === ident.name)
  if (!pokemon) {
    pokemon = makeEmptyPokemon()
    pokemon.name = details.species
    pokemon.pokemonId = toId(details.species)
    pokemon.nickname = ident.name
    pokemon.level = details.level
    side.team.push(pokemon)
  }

  applyHpUpdate(pokemon, hpData, status || undefined)
  pokemon.boosts = defaultBoosts()
  pokemon.volatiles = []
  side.active[idx] = pokemon

  const verb = SWITCH_VERBS[cmd] ?? "appeared"
  return logEntry("switch", `${side.name} ${verb} ${ident.name}!`, state.turn, ident.side)
}

function handleDamageOrHeal(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const hpData = parseHp(args[1])
  const status = parseStatusFromHp(args[1])
  const pokemon = findPokemon(state, ident.side, ident.name)
  const prevPercent = pokemon?.hpPercent ?? 100

  if (pokemon) {
    applyHpUpdate(pokemon, hpData, status || undefined)
  }

  const isHeal = cmd === "-heal"
  const newPercent = pokemon?.hpPercent ?? 0
  const delta = Math.abs(newPercent - prevPercent)
  const source = args[2] ? ` (${args[2].replace("[from] ", "")})` : ""
  const hpDetail =
    delta > 0 ? ` (${newPercent}%, ${isHeal ? "+" : "-"}${delta}%)` : ` (${newPercent}%)`
  return logEntry(
    isHeal ? "heal" : "damage",
    `${ident.name} ${isHeal ? "restored" : "lost"} HP!${hpDetail}${source}`,
    state.turn,
    ident.side,
  )
}

function handleBoostChange(state: BattleState, cmd: string, args: string[]): BattleLogEntry | null {
  const isBoost = cmd === "-boost"
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const stat = args[1]
  const amount = parseInt(args[2], 10)
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon && isBoostStat(stat)) {
    pokemon.boosts[stat] = isBoost
      ? Math.min(6, pokemon.boosts[stat] + amount)
      : Math.max(-6, pokemon.boosts[stat] - amount)
  }

  const stages = amount === 1 ? "" : amount === 2 ? " sharply" : " drastically"
  const verb = isBoost ? "rose" : "fell"
  return logEntry(
    isBoost ? "boost" : "unboost",
    `${ident.name}'s ${stat} ${verb}${stages}!`,
    state.turn,
    ident.side,
  )
}

function handleWeather(state: BattleState, args: string[]): BattleLogEntry {
  const weather = args[0]
  if (weather === "none") {
    state.field.weather = ""
    state.field.weatherTurns = 0
    return logEntry("weather", "The weather cleared!", state.turn)
  }
  state.field.weather = WEATHER_MAP[weather] || (weather as Weather)
  if (args[1] === "[upkeep]") {
    state.field.weatherTurns = Math.max(0, state.field.weatherTurns - 1)
  } else {
    state.field.weatherTurns = 5
  }
  return logEntry("weather", `The weather is ${weather}!`, state.turn)
}

function handleFieldChange(state: BattleState, cmd: string, args: string[]): BattleLogEntry {
  const fieldName = args[0]?.replace("move: ", "")
  const isStart = cmd === "-fieldstart"

  if (isStart) {
    if (fieldName in TERRAIN_MAP) {
      state.field.terrain = TERRAIN_MAP[fieldName]
      state.field.terrainTurns = 5
    }
    if (fieldName === "Trick Room") state.field.trickRoom = 5
    return logEntry("terrain", `${fieldName} started!`, state.turn)
  }

  if (fieldName?.endsWith("Terrain")) {
    state.field.terrain = ""
    state.field.terrainTurns = 0
  }
  if (fieldName === "Trick Room") state.field.trickRoom = 0
  return logEntry("terrain", `${fieldName} ended!`, state.turn)
}

function handleSideCondition(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const isSideStart = cmd === "-sidestart"
  const sideMatch = args[0]?.match(/^(p[12])/)
  if (!sideMatch || !isSide(sideMatch[1])) return null
  const side = sideMatch[1]
  const hazard = args[1]?.replace("move: ", "")
  const handler = hazard ? SIDE_CONDITION_HANDLERS[hazard] : undefined
  if (handler) {
    if (isSideStart) handler.set(state.sides[side].sideConditions)
    else handler.clear(state.sides[side].sideConditions)
  }
  const verb = isSideStart ? "was set on" : "ended on"
  return logEntry("hazard", `${hazard} ${verb} ${side}'s side!`, state.turn, side)
}

function handleVolatileStart(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const condition = args[1]?.replace("move: ", "")
  const pokemon = findPokemon(state, ident.side, ident.name)

  if (condition === "typechange" && args[2] && pokemon) {
    pokemon.types = args[2]
      .split("/")
      .map((t) => t.trim())
      .filter(isPokemonType)
  }

  if (pokemon && condition && !pokemon.volatiles.includes(condition)) {
    pokemon.volatiles.push(condition)
  }

  const boost = condition ? parseStatBoostCondition(condition) : null
  if (boost) {
    return logEntry(
      "ability",
      `${ident.name}'s ${boost.ability} boosted its ${boost.stat}!`,
      state.turn,
      ident.side,
    )
  }
  return logEntry("start", `${ident.name}: ${condition} started!`, state.turn, ident.side)
}

function handleVolatileEnd(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const condition = args[1]?.replace("move: ", "")
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon && condition) {
    pokemon.volatiles = pokemon.volatiles.filter((v) => v !== condition)
  }
  const endBoost = condition ? parseStatBoostCondition(condition) : null
  if (endBoost) {
    return logEntry(
      "ability",
      `${ident.name}'s ${endBoost.ability} ${endBoost.stat} boost ended!`,
      state.turn,
      ident.side,
    )
  }
  return logEntry("end", `${ident.name}: ${condition} ended!`, state.turn, ident.side)
}

function handleActivate(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0] || "")
  if (!ident) return null
  const effect = args[1] || ""

  if (effect === "item: Air Balloon") {
    const pokemon = findPokemon(state, ident.side, ident.name)
    if (pokemon) pokemon.item = ""
    return logEntry("item", `${ident.name}'s Air Balloon popped!`, state.turn, ident.side)
  }

  if (effect === "ability: Disguise" || effect === "Disguise") {
    return logEntry("ability", `${ident.name}'s Disguise was busted!`, state.turn, ident.side)
  }

  const cleanEffect = effect.replace(/^(ability|item|move): /, "")
  return logEntry("info", `${ident.name}'s ${cleanEffect} activated!`, state.turn, ident.side)
}

function handleMove(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  return logEntry("move", `${ident.name} used ${args[1]}!`, state.turn, ident.side)
}

function handleFaint(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) {
    pokemon.hp = 0
    pokemon.hpPercent = 0
    pokemon.fainted = true
  }
  return logEntry("faint", `${ident.name} fainted!`, state.turn, ident.side)
}

function handleStatus(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const statusId = isStatusCondition(args[1]) ? args[1] : ""
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.status = statusId
  return logEntry(
    "status",
    `${ident.name} ${STATUS_DISPLAY_MAP[statusId] || `got ${statusId}`}!`,
    state.turn,
    ident.side,
  )
}

function handleCureStatus(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.status = ""
  return logEntry("status", `${ident.name} was cured!`, state.turn, ident.side)
}

function handleItemChange(state: BattleState, cmd: string, args: string[]): BattleLogEntry | null {
  const isReveal = cmd === "-item"
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const itemName = args[1]
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.item = isReveal ? itemName : ""
  const verb = isReveal ? "was revealed" : "was consumed"
  return logEntry("item", `${ident.name}'s ${itemName} ${verb}!`, state.turn, ident.side)
}

function handleAbilityReveal(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const abilityName = args[1]
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.ability = abilityName
  return logEntry("ability", `${ident.name}'s ${abilityName} activated!`, state.turn, ident.side)
}

function handleTerastallize(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  if (!isPokemonType(args[1])) return null
  const teraType = args[1]
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) {
    pokemon.teraType = teraType
    pokemon.isTerastallized = true
  }
  state.sides[ident.side].canTera = false
  state.sides[ident.side].hasTerastallized = true
  return logEntry(
    "tera",
    `${ident.name} terastallized into ${teraType} type!`,
    state.turn,
    ident.side,
  )
}

function handleEffectiveness(state: BattleState, cmd: string, args: string[]): BattleLogEntry {
  const ident = parsePokemonIdent(args[0])
  const { type, msg } = EFFECTIVENESS_MESSAGES[cmd]
  return logEntry(type, msg, state.turn, ident?.side)
}

function handleCant(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  return logEntry(
    "cant",
    `${ident.name} can't move! (${args[1] || "unknown"})`,
    state.turn,
    ident.side,
  )
}

function handleWin(state: BattleState, args: string[]): BattleLogEntry {
  state.winner = state.sides.p1.name === args[0] ? "p1" : "p2"
  state.phase = "ended"
  return logEntry("win", `${args[0]} won the battle!`, state.turn)
}

function handleFailOrMiss(state: BattleState, cmd: string, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0] || "")
  if (!ident) return null
  const verb = cmd === "-fail" ? "move failed" : "attack missed"
  return logEntry("info", `${ident.name}'s ${verb}!`, state.turn, ident.side)
}

function handlePrepare(state: BattleState, args: string[]): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0] || "")
  if (!ident) return null
  return logEntry(
    "move",
    `${ident.name} is preparing ${args[1] || "a move"}!`,
    state.turn,
    ident.side,
  )
}

function handleHitCount(state: BattleState, args: string[]): BattleLogEntry {
  const ident = parsePokemonIdent(args[0] || "")
  return logEntry("info", `Hit ${args[1] || "?"} time(s)!`, state.turn, ident?.side)
}

/**
 * Process a single protocol line and mutate the battle state.
 * Returns a BattleLogEntry if the line produces a log message.
 */
export function processLine(state: BattleState, line: string): BattleLogEntry | null {
  const parts = line.split("|")
  if (parts.length < 2) return null
  const cmd = parts[1]
  const args = parts.slice(2)

  switch (cmd) {
    case "turn": {
      const turnNum = parseInt(args[0], 10)
      state.turn = turnNum
      state.log = []
      return logEntry("turn", `=== Turn ${turnNum} ===`, turnNum)
    }

    case "switch":
    case "drag":
    case "replace":
      return handleSwitch(state, cmd, args)

    case "move":
      return handleMove(state, args)

    case "-damage":
    case "-heal":
      return handleDamageOrHeal(state, cmd, args)

    case "faint":
      return handleFaint(state, args)

    case "-status":
      return handleStatus(state, args)

    case "-curestatus":
      return handleCureStatus(state, args)

    case "-boost":
    case "-unboost":
      return handleBoostChange(state, cmd, args)

    case "-weather":
      return handleWeather(state, args)

    case "-fieldstart":
    case "-fieldend":
      return handleFieldChange(state, cmd, args)

    case "-sidestart":
    case "-sideend":
      return handleSideCondition(state, cmd, args)

    case "-item":
    case "-enditem":
      return handleItemChange(state, cmd, args)

    case "-ability":
      return handleAbilityReveal(state, args)

    case "-start":
      return handleVolatileStart(state, args)

    case "-end":
      return handleVolatileEnd(state, args)

    case "-terastallize":
      return handleTerastallize(state, args)

    case "-crit":
    case "-supereffective":
    case "-resisted":
    case "-immune":
      return handleEffectiveness(state, cmd, args)

    case "cant":
      return handleCant(state, args)

    case "win":
      return handleWin(state, args)

    case "tie":
      state.phase = "ended"
      return logEntry("win", "The battle ended in a tie!", state.turn)

    case "player": {
      const playerId = args[0]
      if (isSide(playerId)) {
        state.sides[playerId].name = args[1] || playerId
      }
      return null
    }

    case "gametype":
      if (args[0] === "doubles") state.gameType = "doubles"
      return null

    case "-fail":
    case "-miss":
      return handleFailOrMiss(state, cmd, args)

    case "-activate":
      return handleActivate(state, args)

    case "-prepare":
      return handlePrepare(state, args)

    case "-ohko":
      return logEntry("info", "It's a one-hit KO!", state.turn)

    case "-hitcount":
      return handleHitCount(state, args)

    // No-op protocol commands
    case "teamsize":
    case "gen":
    case "tier":
    case "rule":
    case "rated":
    case "clearpoke":
    case "teampreview":
    case "start":
    case "upkeep":
    case "":
    case "t:":
    case "-hint":
    case "-combine":
    case "-waiting":
    case "-mustrecharge":
    case "-nothing":
    case "-notarget":
    case "-singlemove":
    case "-singleturn":
    case "c":
    case "c:":
    case "chat":
    case "j":
    case "l":
    case "n":
    case "raw":
    case "html":
    case "debug":
    case "seed":
    case "error":
      return null

    default:
      return null
  }
}

/**
 * Process a multi-line protocol chunk (typically one full update).
 *
 * Handles `|split|<side>` markers from @pkmn/sim: after a split marker,
 * the next line is the owner's view (exact HP) and the line after is the
 * spectator view (percentage HP). We keep the owner's view and skip the
 * spectator duplicate.
 */
export function processChunk(state: BattleState, chunk: string): BattleLogEntry[] {
  const entries: BattleLogEntry[] = []
  const lines = chunk.split("\n").filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // |split|<side> means the next two lines are the same event from
    // different perspectives. Process the first (owner, exact HP) and
    // skip the second (spectator, percentage HP).
    if (line.startsWith("|split|")) {
      // Process the owner line (i+1), skip the spectator line (i+2)
      if (i + 1 < lines.length) {
        const entry = processLine(state, lines[i + 1])
        if (entry) {
          entries.push(entry)
          state.log.push(entry)
          state.fullLog.push(entry)
        }
      }
      i += 2 // skip past both the owner and spectator lines
      continue
    }

    const entry = processLine(state, line)
    if (entry) {
      entries.push(entry)
      state.log.push(entry)
      state.fullLog.push(entry)
    }
  }

  return entries
}

/**
 * Parse a |request| JSON to extract available actions.
 */
export function parseRequest(requestJson: string): {
  actions: BattleActionSet | null
  teamPreview: boolean
  wait: boolean
  forceSwitch: boolean
  side?: { name: string; id: string; pokemon: RequestPokemon[] }
} {
  const req = JSON.parse(requestJson)

  if (req.wait) {
    return { actions: null, teamPreview: false, wait: true, forceSwitch: false }
  }

  if (req.teamPreview) {
    return { actions: null, teamPreview: true, wait: false, forceSwitch: false, side: req.side }
  }

  if (req.forceSwitch) {
    // In doubles, forceSwitch is an array like [true, false].
    // Only return forceSwitch actions for slot 0 if slot 0 needs to switch.
    const forceArr: boolean[] = Array.isArray(req.forceSwitch) ? req.forceSwitch : [req.forceSwitch]

    if (forceArr[0]) {
      const switches = extractSwitches(req.side?.pokemon || [])
      return {
        actions: {
          moves: [],
          canTera: false,
          switches,
          forceSwitch: true,
          activeSlot: 0,
        },
        teamPreview: false,
        wait: false,
        forceSwitch: true,
        side: req.side,
      }
    }
    // Slot 0 doesn't need to switch -- fall through to normal move extraction
  }

  // Normal turn: extract moves and switches
  const active = req.active?.[0]
  const moves = extractMoves(active)

  const canTera = active?.canTerastallize != null
  const switches = extractSwitches(req.side?.pokemon || [])

  return {
    actions: {
      moves,
      canTera,
      switches,
      forceSwitch: false,
      activeSlot: 0,
    },
    teamPreview: false,
    wait: false,
    forceSwitch: false,
    side: req.side,
  }
}

/**
 * Parse a |request| JSON to extract available actions for a specific active slot.
 * Used for doubles where each active slot gets its own action set.
 */
export function parseRequestForSlot(
  requestJson: string,
  slotIndex: number,
): {
  actions: BattleActionSet | null
  teamPreview: boolean
  wait: boolean
  forceSwitch: boolean
  side?: { name: string; id: string; pokemon: RequestPokemon[] }
} {
  const req = JSON.parse(requestJson)

  if (req.wait) {
    return { actions: null, teamPreview: false, wait: true, forceSwitch: false }
  }

  if (req.teamPreview) {
    return { actions: null, teamPreview: true, wait: false, forceSwitch: false, side: req.side }
  }

  // Handle forceSwitch array in doubles
  if (req.forceSwitch) {
    const forceArr: boolean[] = Array.isArray(req.forceSwitch) ? req.forceSwitch : [req.forceSwitch]
    if (!forceArr[slotIndex]) {
      // This slot doesn't need to switch
      return { actions: null, teamPreview: false, wait: false, forceSwitch: false }
    }
    const switches = extractSwitches(req.side?.pokemon || [])
    return {
      actions: {
        moves: [],
        canTera: false,
        switches,
        forceSwitch: true,
        activeSlot: slotIndex,
      },
      teamPreview: false,
      wait: false,
      forceSwitch: true,
      side: req.side,
    }
  }

  const active = req.active?.[slotIndex]
  if (!active) {
    return { actions: null, teamPreview: false, wait: false, forceSwitch: false }
  }

  const moves = extractMoves(active)
  const canTera = active?.canTerastallize != null
  const switches = extractSwitches(req.side?.pokemon || [])

  return {
    actions: {
      moves,
      canTera,
      switches,
      forceSwitch: false,
      activeSlot: slotIndex,
    },
    teamPreview: false,
    wait: false,
    forceSwitch: false,
    side: req.side,
  }
}

function extractMoves(active: RequestActive | undefined): BattleActionSet["moves"] {
  return (active?.moves || []).map((m: RequestMove) => {
    const moveData = getRawMove(m.id)
    return {
      name: m.move,
      id: m.id,
      pp: m.pp,
      maxPp: m.maxpp,
      type: (moveData?.type || m.type || "Normal") as PokemonType,
      disabled: m.disabled || false,
      target: m.target || "normal",
      basePower: moveData?.basePower ?? 0,
      category: (moveData?.category ?? "Status") as MoveCategory,
      accuracy: moveData?.accuracy === true ? true : (moveData?.accuracy ?? 100),
      description: moveData?.shortDesc || moveData?.desc || "",
    }
  })
}

function extractSwitches(pokemon: RequestPokemon[]): BattleActionSet["switches"] {
  return pokemon
    .map((p, i) => {
      const hpData = parseHp(p.condition || "0/0")
      const status = parseStatusFromHp(p.condition || "")
      const details = parseDetails(p.details)
      return {
        index: i + 1, // 1-indexed
        name: details.species,
        pokemonId: toId(details.species),
        hp: hpData.hp,
        maxHp: hpData.maxHp,
        status,
        fainted: hpData.hp === 0 || p.condition === "0 fnt",
        active: p.active ?? false,
      }
    })
    .filter((p) => !p.fainted && !p.active)
}

/** Update side pokemon data from request side info */
export function updateSideFromRequest(
  state: BattleState,
  side: Side,
  reqSide: { name: string; id: string; pokemon: RequestPokemon[] },
) {
  state.sides[side].name = reqSide.name

  for (let i = 0; i < reqSide.pokemon.length; i++) {
    const reqPoke = reqSide.pokemon[i]
    const details = parseDetails(reqPoke.details)
    const hpData = parseHp(reqPoke.condition || "100/100")
    const status = parseStatusFromHp(reqPoke.condition || "")

    // Find existing or create
    let pokemon = state.sides[side].team.find(
      (p) => p.name === details.species || p.pokemonId === toId(details.species),
    )

    if (!pokemon) {
      pokemon = makeEmptyPokemon()
      pokemon.name = details.species
      pokemon.pokemonId = toId(details.species)
      pokemon.nickname = reqPoke.ident?.replace(/^p[12][a-d]?: /, "") || details.species
      pokemon.level = details.level
      state.sides[side].team.push(pokemon)
    }

    // Request data is authoritative, but "0 fnt" returns maxHp=0 -- preserve
    // existing maxHp so fainted Pokemon show 0/maxHp instead of 0/0.
    const effectiveMaxHp = hpData.maxHp > 0 ? hpData.maxHp : pokemon.maxHp
    applyHpUpdate(pokemon, { hp: hpData.hp, maxHp: effectiveMaxHp }, status)
    pokemon.item = reqPoke.item || ""
    pokemon.ability = reqPoke.baseAbility || reqPoke.ability || ""
    pokemon.teraType =
      reqPoke.teraType && isPokemonType(reqPoke.teraType) ? reqPoke.teraType : undefined

    // Parse stats
    if (reqPoke.stats) {
      pokemon.stats = {
        hp: hpData.maxHp || pokemon.maxHp,
        atk: reqPoke.stats.atk || 0,
        def: reqPoke.stats.def || 0,
        spa: reqPoke.stats.spa || 0,
        spd: reqPoke.stats.spd || 0,
        spe: reqPoke.stats.spe || 0,
      }
    }

    // Parse moves
    if (reqPoke.moves) {
      pokemon.moves = reqPoke.moves.map((m: string) => {
        const moveData = getRawMove(m)
        return {
          id: m,
          name: moveData?.name || camelCaseToDisplayName(m),
          pp: 0,
          maxPp: 0,
          type: (moveData?.type || "Normal") as PokemonType,
          disabled: false,
          target: moveData?.target || "normal",
        }
      })
    }

    // Mark active
    if (reqPoke.active) {
      const activeIdx = state.sides[side].active.findIndex((a) => a === pokemon)
      if (activeIdx === -1) {
        // Find first empty slot or first slot
        const emptyIdx = state.sides[side].active.findIndex((a) => a === null)
        if (emptyIdx !== -1) {
          state.sides[side].active[emptyIdx] = pokemon
        } else if (state.sides[side].active.length === 0) {
          state.sides[side].active.push(pokemon)
        }
      }
    }
  }
}

function logEntry(type: BattleLogType, message: string, turn: number, side?: Side): BattleLogEntry {
  return { type, message, turn, side }
}

/** Request JSON types from @pkmn/sim */

interface RequestActive {
  moves?: RequestMove[]
  canTerastallize?: string
}

interface RequestMove {
  move: string
  id: string
  pp: number
  maxpp: number
  type?: string
  disabled?: boolean
  target?: string
}

interface RequestPokemon {
  ident?: string
  details: string
  condition: string
  active?: boolean
  stats?: { atk: number; def: number; spa: number; spd: number; spe: number }
  moves: string[]
  baseAbility?: string
  ability?: string
  item?: string
  pokeball?: string
  teraType?: string
}
