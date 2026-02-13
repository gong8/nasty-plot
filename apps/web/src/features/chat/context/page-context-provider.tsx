"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import type { TeamData, PokemonSpecies, PageType } from "@nasty-plot/core"
import { serializeBattleState } from "@nasty-plot/battle-engine/client"
import { useBattleStateContext } from "@/features/battle/context/battle-state-context"
import { fetchJson } from "@/lib/api-client"

export type { PageType } from "@nasty-plot/core"

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

const STATIC_PAGE_SUMMARIES: Partial<Record<PageType, string>> = {
  "pokemon-browser": "User is browsing the Pokemon list",
  "damage-calc": "User is using the damage calculator",
  "battle-live": "User is in a live battle simulation",
  "battle-replay": "User is reviewing a battle replay",
  chat: "User is on the dedicated chat page",
  home: "User is on the home page",
}

export function PageContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const pageType = getPageType(pathname)
  const { teamId, pokemonId, battleId } = extractIds(pathname)

  // Fetch team data when on team page (deduplicates with page's own query)
  const teamQuery = useQuery<{ data: TeamData }>({
    queryKey: ["team", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}`),
    enabled: !!teamId && (pageType === "team-editor" || pageType === "guided-builder"),
  })

  // Fetch pokemon data when on pokemon detail page
  const pokemonQuery = useQuery<{ data: PokemonSpecies }>({
    queryKey: ["pokemon", pokemonId],
    queryFn: () => fetchJson(`/api/pokemon/${pokemonId}`),
    enabled: !!pokemonId && pageType === "pokemon-detail",
  })

  const teamData = teamQuery.data?.data
  const pokemonData = pokemonQuery.data?.data
  const { battleState } = useBattleStateContext()

  const contextSummary = useMemo(() => {
    if (pageType === "guided-builder" && teamData)
      return `User is in the guided team builder for "${teamData.name}" (${teamData.formatId}, ${teamData.slots.length}/6 slots)`
    if (pageType === "team-editor" && teamData)
      return `User is on the team editor for "${teamData.name}" (${teamData.formatId}, ${teamData.slots.length}/6 slots)`
    if (pageType === "pokemon-detail" && pokemonData)
      return `User is viewing ${pokemonData.name} (${pokemonData.types.join("/")})`
    if ((pageType === "battle-live" || pageType === "battle-replay") && battleState)
      return serializeBattleState(battleState)

    return STATIC_PAGE_SUMMARIES[pageType] ?? ""
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
