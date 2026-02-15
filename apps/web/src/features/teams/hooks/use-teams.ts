"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  TeamCreateInput,
  TeamData,
  TeamSlotInput,
  TeamDiff,
  ForkOptions,
  MergeDecision,
  MergeOptions,
  LineageNode,
} from "@nasty-plot/core"
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client"

// --- Queries ---

export function useTeams(formatId?: string, includeArchived?: boolean) {
  const searchParams = new URLSearchParams()
  if (formatId) searchParams.set("formatId", formatId)
  if (includeArchived) searchParams.set("includeArchived", "true")
  const qs = searchParams.toString()
  return useQuery<TeamData[]>({
    queryKey: ["teams", formatId, includeArchived],
    queryFn: async () => {
      const res = await fetchJson<{ data: TeamData[] }>(`/api/teams${qs ? `?${qs}` : ""}`)
      return res.data
    },
  })
}

export function useTeam(teamId: string | null) {
  return useQuery<TeamData>({
    queryKey: ["team", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}`),
    enabled: !!teamId,
  })
}

// --- Mutations ---

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TeamCreateInput) => postJson<TeamData>("/api/teams", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: Partial<TeamCreateInput> }) =>
      putJson<TeamData>(`/api/teams/${teamId}`, data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["teams"] })
      qc.setQueryData(["team", result.id], result)
    },
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) => deleteJson(`/api/teams/${teamId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}

export function useAddSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, slot }: { teamId: string; slot: TeamSlotInput }) =>
      postJson(`/api/teams/${teamId}/slots`, slot),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] })
      qc.invalidateQueries({ queryKey: ["team-compare"] })
    },
  })
}

export function useUpdateSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      teamId,
      position,
      data,
    }: {
      teamId: string
      position: number
      data: Partial<TeamSlotInput>
    }) => putJson(`/api/teams/${teamId}/slots/${position}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] })
      qc.invalidateQueries({ queryKey: ["team-compare"] })
    },
  })
}

export function useRemoveSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, position }: { teamId: string; position: number }) =>
      deleteJson(`/api/teams/${teamId}/slots/${position}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] })
      qc.invalidateQueries({ queryKey: ["team-compare"] })
    },
  })
}

// --- Versioning ---

export function useForkTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, options }: { teamId: string; options?: ForkOptions }) =>
      postJson<TeamData>(`/api/teams/${teamId}/fork`, options ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}

export function useCompareTeams(teamAId?: string, teamBId?: string) {
  return useQuery<TeamDiff>({
    queryKey: ["team-compare", teamAId, teamBId],
    queryFn: () => fetchJson(`/api/teams/compare?a=${teamAId}&b=${teamBId}`),
    enabled: !!teamAId && !!teamBId,
    gcTime: 0,
    staleTime: 0,
  })
}

export function useMergeTeams() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      teamAId: string
      teamBId: string
      decisions: MergeDecision[]
      options?: MergeOptions
    }) =>
      postJson<TeamData>("/api/teams/merge", {
        teamAId: input.teamAId,
        teamBId: input.teamBId,
        decisions: input.decisions,
        ...input.options,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}

export function useLineageTree(teamId?: string) {
  return useQuery<LineageNode>({
    queryKey: ["team-lineage", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}/lineage`),
    enabled: !!teamId,
  })
}

export function useArchiveTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) => postJson(`/api/teams/${teamId}/archive`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}

export function useRestoreTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) => postJson(`/api/teams/${teamId}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}
