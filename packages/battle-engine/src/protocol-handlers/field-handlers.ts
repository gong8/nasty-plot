import type { BattleState, BattleLogEntry, Weather, Terrain, SideConditions } from "../types"
import { isSide, logEntry } from "./utils"
import type { Side } from "./types"

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

export function handleWeather(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
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

export function handleFieldChange(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
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

export function handleSideCondition(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const isSideStart = cmd === "-sidestart"
  const sideMatch = args[0]?.match(/^(p[12])/)
  if (!sideMatch || !isSide(sideMatch[1])) return null
  const side: Side = sideMatch[1]
  const hazard = args[1]?.replace("move: ", "")
  const handler = hazard ? SIDE_CONDITION_HANDLERS[hazard] : undefined
  if (handler) {
    if (isSideStart) handler.set(state.sides[side].sideConditions)
    else handler.clear(state.sides[side].sideConditions)
  }
  const verb = isSideStart ? "was set on" : "ended on"
  return logEntry("hazard", `${hazard} ${verb} ${side}'s side!`, state.turn, side)
}
