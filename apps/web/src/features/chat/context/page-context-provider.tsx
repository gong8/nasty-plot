"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { TeamData, PokemonSpecies } from "@nasty-plot/core";

export type PageType =
  | "team-editor"
  | "pokemon-detail"
  | "pokemon-browser"
  | "damage-calc"
  | "battle-live"
  | "chat"
  | "home"
  | "other";

export interface PageContext {
  pageType: PageType;
  teamId?: string;
  pokemonId?: string;
  formatId?: string;
  teamData?: TeamData;
  pokemonData?: PokemonSpecies;
  contextSummary: string;
}

const PageContextCtx = createContext<PageContext>({
  pageType: "other",
  contextSummary: "",
});

export function usePageContext(): PageContext {
  return useContext(PageContextCtx);
}

function getPageType(pathname: string): PageType {
  if (pathname.match(/^\/teams\/[^/]+$/)) return "team-editor";
  if (pathname.match(/^\/teams\/[^/]+\/guided$/)) return "team-editor";
  if (pathname.match(/^\/pokemon\/[^/]+$/)) return "pokemon-detail";
  if (pathname === "/pokemon") return "pokemon-browser";
  if (pathname === "/damage-calc") return "damage-calc";
  if (pathname === "/battle/live") return "battle-live";
  if (pathname === "/chat") return "chat";
  if (pathname === "/") return "home";
  return "other";
}

function extractIds(pathname: string): { teamId?: string; pokemonId?: string } {
  const teamMatch = pathname.match(/^\/teams\/([^/]+)/);
  const pokemonMatch = pathname.match(/^\/pokemon\/([^/]+)$/);
  return {
    teamId: teamMatch?.[1],
    pokemonId: pokemonMatch?.[1],
  };
}

export function PageContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageType = getPageType(pathname);
  const { teamId, pokemonId } = extractIds(pathname);

  // Fetch team data when on team page (deduplicates with page's own query)
  const teamQuery = useQuery<{ data: TeamData }>({
    queryKey: ["team", teamId],
    queryFn: () => fetch(`/api/teams/${teamId}`).then((r) => r.json()),
    enabled: !!teamId && pageType === "team-editor",
  });

  // Fetch pokemon data when on pokemon detail page
  const pokemonQuery = useQuery<{ data: PokemonSpecies }>({
    queryKey: ["pokemon", pokemonId],
    queryFn: () => fetch(`/api/pokemon/${pokemonId}`).then((r) => r.json()),
    enabled: !!pokemonId && pageType === "pokemon-detail",
  });

  const teamData = teamQuery.data?.data;
  const pokemonData = pokemonQuery.data?.data;

  const contextSummary = useMemo(() => {
    const parts: string[] = [];
    if (pageType === "team-editor" && teamData) {
      parts.push(
        `User is on the team editor for "${teamData.name}" (${teamData.formatId}, ${teamData.slots.length}/6 slots)`
      );
    } else if (pageType === "pokemon-detail" && pokemonData) {
      parts.push(
        `User is viewing ${pokemonData.name} (${pokemonData.types.join("/")})`
      );
    } else if (pageType === "pokemon-browser") {
      parts.push("User is browsing the Pokemon list");
    } else if (pageType === "damage-calc") {
      parts.push("User is using the damage calculator");
    } else if (pageType === "battle-live") {
      parts.push("User is in a live battle simulation");
    } else if (pageType === "chat") {
      parts.push("User is on the dedicated chat page");
    } else if (pageType === "home") {
      parts.push("User is on the home page");
    }
    return parts.join(". ");
  }, [pageType, teamData, pokemonData]);

  const value = useMemo<PageContext>(
    () => ({
      pageType,
      teamId,
      pokemonId,
      formatId: teamData?.formatId,
      teamData,
      pokemonData,
      contextSummary,
    }),
    [pageType, teamId, pokemonId, teamData, pokemonData, contextSummary]
  );

  return (
    <PageContextCtx.Provider value={value}>
      {children}
    </PageContextCtx.Provider>
  );
}
