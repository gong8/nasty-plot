"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import type { TeamData, PokemonSpecies } from "@nasty-plot/core"
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
      const p1 = battleState.sides.p1
      const p2 = battleState.sides.p2
      const p1Active = p1.active[0]
      const p2Active = p2.active[0]
      const p1Alive = p1.team.filter((p) => !p.fainted).length
      const p2Alive = p2.team.filter((p) => !p.fainted).length
      parts.push(
        `Live battle Turn ${battleState.turn}. ` +
          `${p1.name}: ${p1Active?.name ?? "none"} (${p1Active?.hpPercent ?? 0}% HP), ${p1Alive}/${p1.team.length} alive. ` +
          `${p2.name}: ${p2Active?.name ?? "none"} (${p2Active?.hpPercent ?? 0}% HP), ${p2Alive}/${p2.team.length} alive.`,
      )
      if (battleState.field.weather) parts.push(`Weather: ${battleState.field.weather}`)
      if (battleState.field.terrain) parts.push(`Terrain: ${battleState.field.terrain}`)
    } else if (pageType === "battle-live") {
      parts.push("User is in a live battle simulation")
    } else if (pageType === "battle-replay" && battleState) {
      const p1 = battleState.sides.p1
      const p2 = battleState.sides.p2
      const p1Active = p1.active[0]
      const p2Active = p2.active[0]
      parts.push(
        `Replay at Turn ${battleState.turn}. ` +
          `${p1.name}: ${p1Active?.name ?? "none"} (${p1Active?.hpPercent ?? 0}% HP). ` +
          `${p2.name}: ${p2Active?.name ?? "none"} (${p2Active?.hpPercent ?? 0}% HP).`,
      )
      if (battleState.field.weather) parts.push(`Weather: ${battleState.field.weather}`)
      if (battleState.field.terrain) parts.push(`Terrain: ${battleState.field.terrain}`)
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
