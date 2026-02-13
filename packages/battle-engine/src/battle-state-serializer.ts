import {
  calcHpPercent,
  type BattleState,
  type BattlePokemon,
  type BattleSide,
  type SideConditions,
} from "./types"

/**
 * Serialize a BattleState into a comprehensive text snapshot for the LLM.
 */
export function serializeBattleState(state: BattleState): string {
  const lines: string[] = []

  // --- Header ---
  const fieldParts = [`Turn ${state.turn}`, state.format]
  if (state.field.weather)
    fieldParts.push(`Weather: ${state.field.weather} (${state.field.weatherTurns} turns)`)
  if (state.field.terrain)
    fieldParts.push(`Terrain: ${state.field.terrain} (${state.field.terrainTurns} turns)`)
  if (state.field.trickRoom > 0) fieldParts.push(`Trick Room (${state.field.trickRoom} turns)`)
  lines.push(fieldParts.join(" | "))
  lines.push("")

  // --- Player side ---
  lines.push(...serializeSide(state.sides.p1, "YOUR TEAM", true))
  lines.push("")

  // --- Opponent side ---
  lines.push(...serializeSide(state.sides.p2, "OPPONENT", false))
  lines.push("")

  // --- Available actions ---
  if (state.availableActions) {
    lines.push("=== AVAILABLE ACTIONS ===")
    const acts = state.availableActions

    if (acts.forceSwitch) {
      lines.push("** FORCED SWITCH — a Pokemon fainted, you must switch **")
    } else {
      lines.push("Moves:")
      for (const m of acts.moves) {
        const acc = m.accuracy === true ? "—" : `${m.accuracy}%`
        const dis = m.disabled ? " [DISABLED]" : ""
        lines.push(
          `  - ${m.name} (${m.type}, ${m.category}, ${m.basePower} BP, ${acc} acc, ${m.pp}/${m.maxPp} PP)${dis}`,
        )
      }
    }

    if (acts.canTera) {
      const active = state.sides.p1.active[0]
      lines.push(`Can Terastallize: Yes${active?.teraType ? ` (${active.teraType})` : ""}`)
    }

    if (acts.switches.length > 0) {
      lines.push("Switches:")
      for (const sw of acts.switches) {
        if (sw.fainted) continue
        const hpPct = calcHpPercent(sw.hp, sw.maxHp)
        const sts = sw.status ? ` ${sw.status.toUpperCase()}` : ""
        lines.push(`  - ${sw.name} (${hpPct}% HP${sts})`)
      }
    }
    lines.push("")
  }

  // --- Opponent predictions ---
  if (state.opponentPredictions && Object.keys(state.opponentPredictions).length > 0) {
    lines.push("=== OPPONENT SET PREDICTIONS ===")
    for (const pred of Object.values(state.opponentPredictions)) {
      const movesStr = pred.predictedMoves.join(", ")
      const parts = [`${pred.pokemonId}: ${movesStr}`]
      if (pred.predictedItem) parts.push(`@ ${pred.predictedItem}`)
      if (pred.predictedAbility) parts.push(`[${pred.predictedAbility}]`)
      parts.push(`(${Math.round(pred.confidence * 100)}% conf)`)
      lines.push(`  ${parts.join(" ")}`)
    }
    lines.push("")
  }

  // --- Recent log (last 6 entries for context) ---
  if (state.log.length > 0) {
    lines.push("=== THIS TURN'S LOG ===")
    for (const entry of state.log.slice(-8)) {
      lines.push(`  ${entry.message}`)
    }
  }

  return lines.join("\n")
}

function serializeSide(side: BattleSide, label: string, isPlayer: boolean): string[] {
  const lines: string[] = []
  lines.push(`=== ${label} (${side.name}) ===`)

  // Side conditions
  const conds = serializeSideConditions(side.sideConditions)
  if (conds) lines.push(conds)

  const teraStr = side.hasTerastallized ? "Already used" : side.canTera ? "Available" : "No"
  lines.push(`Tera: ${teraStr}`)

  // Active Pokemon (detailed)
  for (const poke of side.active) {
    if (!poke) continue
    lines.push(`Active: ${serializePokemon(poke, isPlayer)}`)
  }

  // Bench Pokemon (summary)
  const bench = side.team.filter(
    (p) => !side.active.some((a) => a && a.speciesId === p.speciesId && a.hp === p.hp),
  )
  if (bench.length > 0) {
    lines.push("Bench:")
    for (const p of bench) {
      if (p.fainted) {
        lines.push(`  - ${p.name} (FAINTED)`)
      } else {
        const sts = p.status ? ` | ${p.status.toUpperCase()}` : ""
        const item = isPlayer && p.item ? ` @ ${p.item}` : ""
        lines.push(`  - ${p.name} (${p.hpPercent}% HP${sts})${item}`)
      }
    }
  }

  return lines
}

function serializePokemon(p: BattlePokemon, full: boolean): string {
  const parts: string[] = []
  const typeStr = p.types.join("/")
  const tera = p.isTerastallized ? ` [Tera ${p.teraType}]` : ""
  parts.push(`${p.name} (${typeStr})${tera}`)

  if (p.item) parts.push(`@ ${p.item}`)
  if (p.ability) parts.push(`[${p.ability}]`)

  parts.push(`${p.hpPercent}% HP`)
  if (p.status) parts.push(`Status: ${p.status.toUpperCase()}`)

  // Moves — always show for player, show known moves for opponent
  if (full && p.moves.length > 0) {
    const movesStr = p.moves
      .map((m) => {
        const dis = m.disabled ? " DISABLED" : ""
        return `${m.name} (${m.type}, ${m.pp}/${m.maxPp}${dis})`
      })
      .join(", ")
    parts.push(`Moves: ${movesStr}`)
  } else if (p.moves.length > 0) {
    // Opponent — show whatever moves are known
    const movesStr = p.moves.map((m) => m.name).join(", ")
    parts.push(`Known moves: ${movesStr}`)
  }

  // Stat boosts
  const boosts = Object.entries(p.boosts)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
  if (boosts.length > 0) parts.push(`Boosts: ${boosts.join(", ")}`)

  // Volatiles
  if (p.volatiles.length > 0) parts.push(`Conditions: ${p.volatiles.join(", ")}`)

  return parts.join(" | ")
}

/**
 * Format side conditions into a comma-separated string.
 * Returns empty string if no conditions are active.
 */
export function formatSideConditions(sc: SideConditions): string {
  const parts: string[] = []
  if (sc.stealthRock) parts.push("Stealth Rock")
  if (sc.spikes > 0) parts.push(`Spikes x${sc.spikes}`)
  if (sc.toxicSpikes > 0) parts.push(`Toxic Spikes x${sc.toxicSpikes}`)
  if (sc.stickyWeb) parts.push("Sticky Web")
  if (sc.reflect > 0) parts.push(`Reflect (${sc.reflect}t)`)
  if (sc.lightScreen > 0) parts.push(`Light Screen (${sc.lightScreen}t)`)
  if (sc.auroraVeil > 0) parts.push(`Aurora Veil (${sc.auroraVeil}t)`)
  if (sc.tailwind > 0) parts.push(`Tailwind (${sc.tailwind}t)`)
  return parts.join(", ")
}

function serializeSideConditions(sc: SideConditions): string {
  const formatted = formatSideConditions(sc)
  return formatted ? `Hazards/Screens: ${formatted}` : ""
}
