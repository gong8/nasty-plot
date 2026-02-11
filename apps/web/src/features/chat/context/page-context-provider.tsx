"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import type { TeamData, PokemonSpecies } from "@nasty-plot/core"
import type {
  BattleState,
  BattlePokemon,
  BattleSide,
  SideConditions,
} from "@nasty-plot/battle-engine"
import { useBattleStateContext } from "@/features/battle/context/battle-state-context"

export type PageType =
  | "guided-builder"
  | "team-editor"
  | "pokemon-detail"
  | "pokemon-browser"
  | "damage-calc"
  | "battle-live"
  | "battle-replay"
  | "chat"
  | "home"
  | "other"

export interface PageContext {
  pageType: PageType
  teamId?: string
  pokemonId?: string
  battleId?: string
  formatId?: string
  teamData?: TeamData
  pokemonData?: PokemonSpecies
  contextSummary: string
}

const PageContextCtx = createContext<PageContext>({
  pageType: "other",
  contextSummary: "",
})

export function usePageContext(): PageContext {
  return useContext(PageContextCtx)
}

function getPageType(pathname: string): PageType {
  if (pathname.match(/^\/teams\/[^/]+\/guided$/)) return "guided-builder"
  if (pathname.match(/^\/teams\/[^/]+$/)) return "team-editor"
  if (pathname.match(/^\/pokemon\/[^/]+$/)) return "pokemon-detail"
  if (pathname === "/pokemon") return "pokemon-browser"
  if (pathname === "/damage-calc") return "damage-calc"
  if (pathname === "/battle/live") return "battle-live"
  if (pathname.match(/^\/battle\/replay\//)) return "battle-replay"
  if (pathname === "/chat") return "chat"
  if (pathname === "/") return "home"
  return "other"
}

function extractIds(pathname: string): {
  teamId?: string
  pokemonId?: string
  battleId?: string
} {
  const teamMatch = pathname.match(/^\/teams\/([^/]+)/)
  const pokemonMatch = pathname.match(/^\/pokemon\/([^/]+)$/)
  const battleMatch = pathname.match(/^\/battle\/replay\/([^/]+)/)
  return {
    teamId: teamMatch?.[1],
    pokemonId: pokemonMatch?.[1],
    battleId: battleMatch?.[1],
  }
}

// ---------------------------------------------------------------------------
// Battle state serializer — produces a comprehensive text snapshot for the LLM
// ---------------------------------------------------------------------------

function serializeBattleState(state: BattleState): string {
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
        const hpPct = sw.maxHp > 0 ? Math.round((sw.hp / sw.maxHp) * 100) : 0
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

function serializeSideConditions(sc: SideConditions): string {
  const parts: string[] = []
  if (sc.stealthRock) parts.push("Stealth Rock")
  if (sc.spikes > 0) parts.push(`Spikes x${sc.spikes}`)
  if (sc.toxicSpikes > 0) parts.push(`Toxic Spikes x${sc.toxicSpikes}`)
  if (sc.stickyWeb) parts.push("Sticky Web")
  if (sc.reflect > 0) parts.push(`Reflect (${sc.reflect}t)`)
  if (sc.lightScreen > 0) parts.push(`Light Screen (${sc.lightScreen}t)`)
  if (sc.auroraVeil > 0) parts.push(`Aurora Veil (${sc.auroraVeil}t)`)
  if (sc.tailwind > 0) parts.push(`Tailwind (${sc.tailwind}t)`)
  return parts.length > 0 ? `Hazards/Screens: ${parts.join(", ")}` : ""
}

export function PageContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const pageType = getPageType(pathname)
  const { teamId, pokemonId, battleId } = extractIds(pathname)

  // Fetch team data when on team page (deduplicates with page's own query)
  const teamQuery = useQuery<{ data: TeamData }>({
    queryKey: ["team", teamId],
    queryFn: () => fetch(`/api/teams/${teamId}`).then((r) => r.json()),
    enabled: !!teamId && (pageType === "team-editor" || pageType === "guided-builder"),
  })

  // Fetch pokemon data when on pokemon detail page
  const pokemonQuery = useQuery<{ data: PokemonSpecies }>({
    queryKey: ["pokemon", pokemonId],
    queryFn: () => fetch(`/api/pokemon/${pokemonId}`).then((r) => r.json()),
    enabled: !!pokemonId && pageType === "pokemon-detail",
  })

  const teamData = teamQuery.data?.data
  const pokemonData = pokemonQuery.data?.data
  const { battleState } = useBattleStateContext()

  const contextSummary = useMemo(() => {
    const parts: string[] = []
    if (pageType === "guided-builder" && teamData) {
      parts.push(
        `User is in the guided team builder for "${teamData.name}" (${teamData.formatId}, ${teamData.slots.length}/6 slots)`,
      )
    } else if (pageType === "team-editor" && teamData) {
      parts.push(
        `User is on the team editor for "${teamData.name}" (${teamData.formatId}, ${teamData.slots.length}/6 slots)`,
      )
    } else if (pageType === "pokemon-detail" && pokemonData) {
      parts.push(`User is viewing ${pokemonData.name} (${pokemonData.types.join("/")})`)
    } else if (pageType === "pokemon-browser") {
      parts.push("User is browsing the Pokemon list")
    } else if (pageType === "damage-calc") {
      parts.push("User is using the damage calculator")
    } else if (pageType === "battle-live" && battleState) {
      parts.push(serializeBattleState(battleState))
    } else if (pageType === "battle-live") {
      parts.push("User is in a live battle simulation")
    } else if (pageType === "battle-replay" && battleState) {
      parts.push(serializeBattleState(battleState))
    } else if (pageType === "battle-replay") {
      parts.push("User is reviewing a battle replay")
    } else if (pageType === "chat") {
      parts.push("User is on the dedicated chat page")
    } else if (pageType === "home") {
      parts.push("User is on the home page")
    }
    return parts.join(". ")
  }, [pageType, teamData, pokemonData, battleState])

  const value = useMemo<PageContext>(
    () => ({
      pageType,
      teamId,
      pokemonId,
      battleId,
      formatId: teamData?.formatId,
      teamData,
      pokemonData,
      contextSummary,
    }),
    [pageType, teamId, pokemonId, battleId, teamData, pokemonData, contextSummary],
  )

  return <PageContextCtx.Provider value={value}>{children}</PageContextCtx.Provider>
}
