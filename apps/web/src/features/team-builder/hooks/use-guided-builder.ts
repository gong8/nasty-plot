"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  UsageStatsEntry,
  PaginatedResponse,
  SmogonSetData,
  ApiResponse,
  TeamSlotData,
  NatureName,
  PokemonType,
  StatsTable,
} from "@nasty-plot/core";
import { DEFAULT_EVS, DEFAULT_IVS } from "@nasty-plot/core";

// --- Types ---

export type GuidedStep = 1 | 2 | 3 | 4;

export interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface CorePokemon {
  pokemonId: string;
  pokemonName: string;
  types: PokemonType[];
  usagePercent: number;
}

const ALL_ROLES: RoleDefinition[] = [
  { id: "physical-wall", label: "Physical Wall", description: "A bulky Pokemon that takes physical hits", icon: "shield" },
  { id: "special-wall", label: "Special Wall", description: "A bulky Pokemon that takes special hits", icon: "shield" },
  { id: "physical-attacker", label: "Physical Attacker", description: "Hits hard on the physical side", icon: "swords" },
  { id: "special-attacker", label: "Special Attacker", description: "Hits hard on the special side", icon: "zap" },
  { id: "speed-control", label: "Speed Control", description: "A fast Pokemon or one with speed-boosting moves", icon: "gauge" },
  { id: "hazard-setter", label: "Hazard Setter", description: "Sets entry hazards like Stealth Rock or Spikes", icon: "triangle-alert" },
  { id: "hazard-removal", label: "Hazard Removal", description: "Removes entry hazards with Defog or Rapid Spin", icon: "eraser" },
];

// --- Fetchers ---

async function fetchUsage(formatId: string, limit: number): Promise<UsageStatsEntry[]> {
  const res = await fetch(`/api/formats/${formatId}/usage?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch usage stats");
  const json: PaginatedResponse<UsageStatsEntry> = await res.json();
  return json.data;
}

async function fetchSets(pokemonId: string, format: string): Promise<SmogonSetData[]> {
  const res = await fetch(`/api/pokemon/${pokemonId}/sets?format=${format}`);
  if (!res.ok) return [];
  const json: ApiResponse<SmogonSetData[]> = await res.json();
  return json.data;
}

// --- Hook ---

export function useGuidedBuilder(formatId: string) {
  const [step, setStep] = useState<GuidedStep>(1);
  const [corePicks, setCorePicks] = useState<CorePokemon[]>([]);
  const [rolePicks, setRolePicks] = useState<Record<string, CorePokemon | null>>({});
  const [teamSlots, setTeamSlots] = useState<Partial<TeamSlotData>[]>([]);

  // Fetch popular Pokemon for the format
  const usageQuery = useQuery({
    queryKey: ["guided-usage", formatId],
    queryFn: () => fetchUsage(formatId, 30),
    enabled: !!formatId,
  });

  // --- Navigation ---

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(s + 1, 4) as GuidedStep);
  }, []);

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1) as GuidedStep);
  }, []);

  const goToStep = useCallback((n: GuidedStep) => {
    setStep(n);
  }, []);

  // --- Core picks ---

  const toggleCorePick = useCallback((pokemon: CorePokemon) => {
    setCorePicks((prev) => {
      const exists = prev.find((p) => p.pokemonId === pokemon.pokemonId);
      if (exists) return prev.filter((p) => p.pokemonId !== pokemon.pokemonId);
      if (prev.length >= 3) return prev;
      return [...prev, pokemon];
    });
  }, []);

  // --- Role picks ---

  const setRolePick = useCallback((roleId: string, pokemon: CorePokemon | null) => {
    setRolePicks((prev) => ({ ...prev, [roleId]: pokemon }));
  }, []);

  // Determine which roles are suggested based on core
  const suggestedRoles = useMemo((): RoleDefinition[] => {
    if (corePicks.length === 0) return ALL_ROLES.slice(0, 5);

    const types = corePicks.flatMap((p) => p.types);
    const roles: RoleDefinition[] = [];

    // Always suggest hazard setter and removal
    roles.push(ALL_ROLES.find((r) => r.id === "hazard-setter")!);
    roles.push(ALL_ROLES.find((r) => r.id === "hazard-removal")!);

    // Check offensive balance
    const hasPhysical = types.some((t) => ["Fighting", "Ground", "Rock"].includes(t));
    const hasSpecial = types.some((t) => ["Psychic", "Electric", "Fire"].includes(t));
    if (!hasSpecial) roles.push(ALL_ROLES.find((r) => r.id === "special-attacker")!);
    if (!hasPhysical) roles.push(ALL_ROLES.find((r) => r.id === "physical-attacker")!);

    // Check defensive balance
    roles.push(ALL_ROLES.find((r) => r.id === "physical-wall")!);
    roles.push(ALL_ROLES.find((r) => r.id === "speed-control")!);

    // Deduplicate and limit
    const seen = new Set<string>();
    return roles.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).slice(0, 5);
  }, [corePicks]);

  // --- Assemble team ---

  const assembleTeam = useCallback(() => {
    const all: CorePokemon[] = [
      ...corePicks,
      ...Object.values(rolePicks).filter(Boolean) as CorePokemon[],
    ];

    // Deduplicate
    const seen = new Set<string>();
    const unique = all.filter((p) => {
      if (seen.has(p.pokemonId)) return false;
      seen.add(p.pokemonId);
      return true;
    });

    const slots: Partial<TeamSlotData>[] = unique.slice(0, 6).map((p, i) => ({
      position: i + 1,
      pokemonId: p.pokemonId,
      ability: "",
      item: "",
      nature: "Adamant" as NatureName,
      level: 100,
      moves: [""] as TeamSlotData["moves"],
      evs: { ...DEFAULT_EVS } as StatsTable,
      ivs: { ...DEFAULT_IVS } as StatsTable,
    }));

    setTeamSlots(slots);
    return slots;
  }, [corePicks, rolePicks]);

  // Apply a Smogon set to a slot
  const applySet = useCallback(
    async (position: number, pokemonId: string) => {
      try {
        const sets = await fetchSets(pokemonId, formatId);
        if (sets.length === 0) return;

        const set = sets[0]; // Use first (most popular) set
        setTeamSlots((prev) =>
          prev.map((slot) => {
            if (slot.position !== position) return slot;
            const moves = set.moves.map((m) => (Array.isArray(m) ? m[0] : m));
            return {
              ...slot,
              ability: set.ability,
              item: set.item,
              nature: set.nature,
              teraType: set.teraType,
              moves: [
                moves[0] ?? "",
                moves[1],
                moves[2],
                moves[3],
              ] as TeamSlotData["moves"],
              evs: { ...DEFAULT_EVS, ...set.evs } as StatsTable,
              ivs: { ...DEFAULT_IVS, ...(set.ivs ?? {}) } as StatsTable,
            };
          })
        );
      } catch {
        // Silently fail - sets are optional enhancement
      }
    },
    [formatId]
  );

  // All selected Pokemon IDs (for filtering)
  const allSelectedIds = useMemo(() => {
    const ids = new Set(corePicks.map((p) => p.pokemonId));
    Object.values(rolePicks).forEach((p) => {
      if (p) ids.add(p.pokemonId);
    });
    return ids;
  }, [corePicks, rolePicks]);

  // Type coverage summary
  const typeCoverage = useMemo(() => {
    const types = [
      ...corePicks.flatMap((p) => p.types),
      ...Object.values(rolePicks)
        .filter(Boolean)
        .flatMap((p) => (p as CorePokemon).types),
    ];
    const unique = [...new Set(types)];
    return unique;
  }, [corePicks, rolePicks]);

  return {
    // State
    step,
    corePicks,
    rolePicks,
    teamSlots,
    suggestedRoles,
    allSelectedIds,
    typeCoverage,

    // Data
    usageData: usageQuery.data ?? [],
    isLoadingUsage: usageQuery.isLoading,

    // Navigation
    nextStep,
    prevStep,
    goToStep,

    // Actions
    toggleCorePick,
    setRolePick,
    assembleTeam,
    applySet,
    setTeamSlots,
  };
}
