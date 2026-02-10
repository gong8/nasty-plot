"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  TeamCreateInput,
  TeamData,
  TeamSlotInput,
  TeamDiff,
  ForkOptions,
  MergeDecision,
  MergeOptions,
  LineageNode,
} from "@nasty-plot/core";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

// --- Queries ---

export function useTeams(formatId?: string, includeArchived?: boolean) {
  const searchParams = new URLSearchParams();
  if (formatId) searchParams.set("formatId", formatId);
  if (includeArchived) searchParams.set("includeArchived", "true");
  const qs = searchParams.toString();
  return useQuery<TeamData[]>({
    queryKey: ["teams", formatId, includeArchived],
    queryFn: () => fetchJson(`/api/teams${qs ? `?${qs}` : ""}`),
  });
}

export function useTeam(teamId: string | null) {
  return useQuery<TeamData>({
    queryKey: ["team", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}`),
    enabled: !!teamId,
  });
}

// --- Mutations ---

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TeamCreateInput) =>
      fetchJson<TeamData>("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      data,
    }: {
      teamId: string;
      data: Partial<TeamCreateInput>;
    }) =>
      fetchJson<TeamData>(`/api/teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.setQueryData(["team", data.id], data);
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) =>
      fetchJson(`/api/teams/${teamId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      slot,
    }: {
      teamId: string;
      slot: TeamSlotInput;
    }) =>
      fetchJson(`/api/teams/${teamId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slot),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] });
    },
  });
}

export function useUpdateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      position,
      data,
    }: {
      teamId: string;
      position: number;
      data: Partial<TeamSlotInput>;
    }) =>
      fetchJson(`/api/teams/${teamId}/slots/${position}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] });
    },
  });
}

export function useRemoveSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      position,
    }: {
      teamId: string;
      position: number;
    }) =>
      fetchJson(`/api/teams/${teamId}/slots/${position}`, {
        method: "DELETE",
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] });
    },
  });
}

// --- Versioning ---

export function useForkTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, options }: { teamId: string; options?: ForkOptions }) =>
      fetchJson<TeamData>(`/api/teams/${teamId}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options ?? {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useCompareTeams(teamAId?: string, teamBId?: string) {
  return useQuery<TeamDiff>({
    queryKey: ["team-compare", teamAId, teamBId],
    queryFn: () => fetchJson(`/api/teams/compare?a=${teamAId}&b=${teamBId}`),
    enabled: !!teamAId && !!teamBId,
  });
}

export function useMergeTeams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      teamAId: string;
      teamBId: string;
      decisions: MergeDecision[];
      options?: MergeOptions;
    }) =>
      fetchJson<TeamData>("/api/teams/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamAId: input.teamAId,
          teamBId: input.teamBId,
          decisions: input.decisions,
          ...input.options,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useLineageTree(teamId?: string) {
  return useQuery<LineageNode>({
    queryKey: ["team-lineage", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}/lineage`),
    enabled: !!teamId,
  });
}

export function useArchiveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) =>
      fetchJson(`/api/teams/${teamId}/archive`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useRestoreTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) =>
      fetchJson(`/api/teams/${teamId}/restore`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
