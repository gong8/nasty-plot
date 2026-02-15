import type { ProtocolHandler } from "./types"
import {
  handleMove,
  handleFailOrMiss,
  handlePrepare,
  handleCant,
  handleHitCount,
} from "./move-handlers"
import { handleDamageOrHeal } from "./damage-handlers"
import { handleStatus, handleCureStatus, handleBoostChange } from "./status-handlers"
import { handleWeather, handleFieldChange, handleSideCondition } from "./field-handlers"
import { handleSwitch, handleFaint } from "./switch-handlers"
import { handleTurn, handleWin, handleTie, handlePlayer, handleGametype } from "./turn-handlers"
import {
  handleItemChange,
  handleAbilityReveal,
  handleTerastallize,
  handleVolatileStart,
  handleVolatileEnd,
  handleActivate,
} from "./ability-item-handlers"
import { handleEffectiveness, handleOhko } from "./misc-handlers"

export type { ProtocolHandler } from "./types"

/**
 * Map of protocol command strings to their handler functions.
 * Each handler receives (state, cmd, args) and returns a BattleLogEntry or null.
 */
export const PROTOCOL_HANDLERS: Record<string, ProtocolHandler> = {
  // Turn/game flow
  turn: handleTurn,
  win: handleWin,
  tie: handleTie,
  player: handlePlayer,
  gametype: handleGametype,

  // Switching
  switch: handleSwitch,
  drag: handleSwitch,
  replace: handleSwitch,
  faint: handleFaint,

  // Moves
  move: handleMove,
  "-fail": handleFailOrMiss,
  "-miss": handleFailOrMiss,
  "-prepare": handlePrepare,
  cant: handleCant,
  "-hitcount": handleHitCount,

  // Damage/healing
  "-damage": handleDamageOrHeal,
  "-heal": handleDamageOrHeal,

  // Status/boosts
  "-status": handleStatus,
  "-curestatus": handleCureStatus,
  "-boost": handleBoostChange,
  "-unboost": handleBoostChange,

  // Field conditions
  "-weather": handleWeather,
  "-fieldstart": handleFieldChange,
  "-fieldend": handleFieldChange,
  "-sidestart": handleSideCondition,
  "-sideend": handleSideCondition,

  // Items/abilities
  "-item": handleItemChange,
  "-enditem": handleItemChange,
  "-ability": handleAbilityReveal,
  "-terastallize": handleTerastallize,

  // Volatile conditions
  "-start": handleVolatileStart,
  "-end": handleVolatileEnd,
  "-activate": handleActivate,

  // Effectiveness
  "-crit": handleEffectiveness,
  "-supereffective": handleEffectiveness,
  "-resisted": handleEffectiveness,
  "-immune": handleEffectiveness,
  "-ohko": handleOhko,
}

/**
 * Set of protocol commands that are intentionally ignored (no-ops).
 * Separated from PROTOCOL_HANDLERS so we can distinguish "handled" from "ignored".
 */
export const NOOP_COMMANDS = new Set([
  "teamsize",
  "gen",
  "tier",
  "rule",
  "rated",
  "clearpoke",
  "teampreview",
  "start",
  "upkeep",
  "",
  "t:",
  "-hint",
  "-combine",
  "-waiting",
  "-mustrecharge",
  "-nothing",
  "-notarget",
  "-singlemove",
  "-singleturn",
  "c",
  "c:",
  "chat",
  "j",
  "l",
  "n",
  "raw",
  "html",
  "debug",
  "seed",
  "error",
])
