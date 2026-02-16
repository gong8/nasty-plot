"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchJson, postJson } from "@/lib/api-client"
import { useTeamBuilder } from "./use-team-builder"
import {
  useUpdateTeam,
  useDeleteTeam,
  useAddSlot,
  useUpdateSlot,
  useRemoveSlot,
  useForkTeam,
  useCompareTeams,
  useLineageTree,
  useArchiveTeam,
  useMergeTeams,
} from "@/features/teams/hooks/use-teams"
import type {
  TeamSlotInput,
  TeamAnalysis,
  MatchupMatrixEntry,
  MergeDecision,
} from "@nasty-plot/core"

const TOTAL_TYPES = 18

function computeCoverageScore(analysis: TeamAnalysis | undefined): number {
  if (!analysis?.coverage?.offensive) return 0
  const totalCoverage = Object.values(analysis.coverage.offensive).reduce((a, b) => a + b, 0)
  return Math.round((totalCoverage / TOTAL_TYPES) * 100)
}

export function useTeamEditor(teamId: string) {
  const router = useRouter()
  const { team, isLoading, error, selectedSlot, selectedSlotData, selectSlot, refetch } =
    useTeamBuilder(teamId)

  const [addingNew, setAddingNew] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [compareTargetId, setCompareTargetId] = useState<string | undefined>()
  const [mergeOpen, setMergeOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [customThreatIds, setCustomThreatIds] = useState<string[]>([])

  const updateTeamMut = useUpdateTeam()
  const deleteTeamMut = useDeleteTeam()
  const addSlotMut = useAddSlot()
  const updateSlotMut = useUpdateSlot()
  const removeSlotMut = useRemoveSlot()
  const forkTeamMut = useForkTeam()
  const archiveTeamMut = useArchiveTeam()
  const mergeTeamsMut = useMergeTeams()
  const lineageQuery = useLineageTree(teamId)
  const compareQuery = useCompareTeams(compareTargetId ? teamId : undefined, compareTargetId)

  // Fetch analysis data when team has slots
  const analysisQuery = useQuery<{ data: TeamAnalysis }>({
    queryKey: ["team-analysis", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}/analysis`),
    enabled: !!team && team.slots.length > 0,
  })

  // Fetch matchup matrix when matchups tab is selected
  const matchupQuery = useQuery<{ data: MatchupMatrixEntry[][] }>({
    queryKey: ["matchup-matrix", teamId, team?.formatId, customThreatIds],
    queryFn: () =>
      postJson("/api/damage-calc/matchup-matrix", {
        teamId,
        formatId: team?.formatId,
        ...(customThreatIds.length > 0 && { threatIds: customThreatIds }),
      }),
    enabled: activeTab === "matchups" && !!team && team.slots.length > 0,
  })

  const handleFork = useCallback(
    async (options: { name: string; branchName?: string; notes?: string }) => {
      const forked = await forkTeamMut.mutateAsync({
        teamId,
        options,
      })
      router.push(`/teams/${forked.id}`)
    },
    [teamId, forkTeamMut, router],
  )

  const handleArchive = useCallback(async () => {
    await archiveTeamMut.mutateAsync(teamId)
    router.push("/teams")
  }, [teamId, archiveTeamMut, router])

  const handleMerge = useCallback(
    async (
      decisions: MergeDecision[],
      options: { name: string; branchName?: string; notes?: string },
    ) => {
      if (!compareTargetId) return
      const merged = await mergeTeamsMut.mutateAsync({
        teamAId: teamId,
        teamBId: compareTargetId,
        decisions,
        options,
      })
      setMergeOpen(false)
      router.push(`/teams/${merged.id}`)
    },
    [teamId, compareTargetId, mergeTeamsMut, router],
  )

  const handleUpdateName = useCallback(
    (name: string) => {
      updateTeamMut.mutate({ teamId, data: { name } })
    },
    [teamId, updateTeamMut],
  )

  const handleDelete = useCallback(async () => {
    await deleteTeamMut.mutateAsync(teamId)
    router.push("/teams")
  }, [teamId, deleteTeamMut, router])

  const handleImport = useCallback(
    async (paste: string) => {
      if (!team) return
      await postJson(`/api/teams/${teamId}/import`, { paste })
      await refetch()
    },
    [team, teamId, refetch],
  )

  const handleAddSlot = useCallback(() => {
    setAddingNew(true)
    selectSlot(null)
  }, [selectSlot])

  const handleSaveSlot = useCallback(
    async (data: TeamSlotInput) => {
      if (addingNew) {
        await addSlotMut.mutateAsync({ teamId, slot: data })
        setAddingNew(false)
      } else if (selectedSlot !== null) {
        await updateSlotMut.mutateAsync({
          teamId,
          position: selectedSlot,
          data,
        })
      }
    },
    [teamId, addingNew, selectedSlot, addSlotMut, updateSlotMut],
  )

  const handleRemoveSlot = useCallback(async () => {
    if (selectedSlot === null) return
    await removeSlotMut.mutateAsync({ teamId, position: selectedSlot })
    selectSlot(null)
  }, [teamId, selectedSlot, removeSlotMut, selectSlot])

  const handleSelectSlot = useCallback(
    (position: number) => {
      setAddingNew(false)
      selectSlot(position)
    },
    [selectSlot],
  )

  const dialogOpen = selectedSlot !== null || addingNew
  const closeDialog = useCallback(() => {
    selectSlot(null)
    setAddingNew(false)
  }, [selectSlot])

  const analysis = analysisQuery.data?.data
  const coverageScore = computeCoverageScore(analysis)
  const nextPosition = team ? team.slots.length + 1 : 1

  return {
    // Core data
    team,
    isLoading,
    error,
    teamId,
    router,

    // Slot selection
    selectedSlot,
    selectedSlotData,
    addingNew,

    // Tab state
    activeTab,
    setActiveTab,

    // Version/merge state
    compareTargetId,
    setCompareTargetId,
    mergeOpen,
    setMergeOpen,
    versionsOpen,
    setVersionsOpen,

    // Threat selection
    customThreatIds,
    setCustomThreatIds,

    // Queries
    analysisQuery,
    matchupQuery,
    lineageQuery,
    compareQuery,

    // Derived data
    analysis,
    coverageScore,
    nextPosition,
    dialogOpen,

    // Mutation loading state
    mergeLoading: mergeTeamsMut.isPending,

    // Handlers
    handleFork,
    handleArchive,
    handleMerge,
    handleUpdateName,
    handleDelete,
    handleImport,
    handleAddSlot,
    handleSaveSlot,
    handleRemoveSlot,
    handleSelectSlot,
    closeDialog,
  }
}
