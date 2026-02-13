"use client"

import { use, useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchJson, postJson } from "@/lib/api-client"
import { ArrowLeft, Plus, Swords, BarChart3, FlaskConical, History } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTeamBuilder } from "@/features/team-builder/hooks/use-team-builder"
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
import { TeamHeader } from "@/features/team-builder/components/team-header"
import { TeamGrid } from "@/features/team-builder/components/team-grid"
import { SlotEditor } from "@/features/team-builder/components/slot-editor"
import { CoverageChart } from "@/features/analysis/components/coverage-chart"
import { WeaknessHeatmap } from "@/features/analysis/components/weakness-heatmap"
import { ThreatList } from "@/features/analysis/components/threat-list"
import { SpeedTiers } from "@/features/analysis/components/speed-tiers"
import { MatchupMatrix } from "@/features/damage-calc/components/matchup-matrix"
import { RecommendationPanel } from "@/features/recommendations/components/recommendation-panel"
import { MergeWizard } from "@/features/team-builder/components/merge-wizard"
import { VersionPanel } from "@/features/team-builder/components/version-panel"
import { OpponentSelector } from "@/features/damage-calc/components/opponent-selector"
import { QuickBattleCard } from "@/features/battle/components/QuickBattleCard"
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

export default function TeamEditorPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
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

  // Fetch analysis data when analysis tab is selected and team has slots
  const analysisQuery = useQuery<{ data: TeamAnalysis }>({
    queryKey: ["team-analysis", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}/analysis`),
    enabled: !!team && team.slots.length > 0, // Always fetch if we have slots, for the dashboard
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
  const handleDialogClose = useCallback(
    (open: boolean) => {
      if (!open) {
        selectSlot(null)
        setAddingNew(false)
      }
    },
    [selectSlot],
  )

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1600px] py-6 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] w-full" />
            ))}
          </div>
          <div className="lg:col-span-8">
            <Skeleton className="h-[600px]" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !team) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold font-display">Team not found</h2>
          <p className="text-muted-foreground mt-2">
            This team has vanished. It may have been deleted.
          </p>
        </div>
      </div>
    )
  }

  const nextPosition = team.slots.length + 1
  const analysis = analysisQuery.data?.data
  const coverageScore = computeCoverageScore(analysis)

  return (
    <div className="min-h-screen bg-background/50">
      <div className="container mx-auto max-w-[1600px] py-6 px-4 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/teams")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <TeamHeader
                team={team}
                onUpdateName={handleUpdateName}
                onDelete={handleDelete}
                onImport={handleImport}
                onFork={handleFork}
                onArchive={handleArchive}
                onShowVersions={() => setVersionsOpen(true)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: ROSTER (Pinned) */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4 sticky top-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Roster ({team.slots.length}/6)
              </h3>
              {team.slots.length < 6 && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleAddSlot}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <TeamGrid
                team={team}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSelectSlot}
                onAddSlot={handleAddSlot}
                layout="vertical" // We need to update TeamGrid to support this layout prop
              />
            </div>

            {/* Mini Analysis Summary Card */}
            {analysis && (
              <Card className="bg-card/30 border-border/40 mt-6">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Coverage Score</span>
                    <span className="font-mono font-bold text-primary">{coverageScore}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${coverageScore}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN: DASHBOARD HUB */}
          <div className="lg:col-span-8 xl:col-span-9 min-h-[500px]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-card/50 border border-border/50 p-1 h-auto">
                  <TabsTrigger
                    value="overview"
                    className="gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  >
                    <BarChart3 className="w-4 h-4" /> Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="battle"
                    className="gap-2 px-4 py-2 data-[state=active]:bg-accent/10 data-[state=active]:text-accent"
                  >
                    <Swords className="w-4 h-4" /> Battle & Test
                  </TabsTrigger>
                  <TabsTrigger
                    value="analysis"
                    className="gap-2 px-4 py-2 data-[state=active]:bg-secondary/20 data-[state=active]:text-secondary-foreground"
                  >
                    <FlaskConical className="w-4 h-4" /> Deep Analysis
                  </TabsTrigger>
                  <TabsTrigger value="matchups" className="gap-2 px-4 py-2">
                    <History className="w-4 h-4" /> Matchups
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="overview"
                className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                {/* Recommendations */}
                {team.slots.length < 6 && (
                  <RecommendationPanel
                    teamId={teamId}
                    formatId={team.formatId}
                    currentSlotCount={team.slots.length}
                  />
                )}

                {/* Main Stats Grid */}
                {team.slots.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Type Coverage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CoverageChart coverage={analysis?.coverage} compact />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Top Threats</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ThreatList
                          threats={analysis?.threats}
                          isLoading={analysisQuery.isLoading}
                          slots={team.slots}
                          compact
                        />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/50 rounded-xl bg-card/20">
                    <p className="text-lg text-muted-foreground font-medium">Your team is empty</p>
                    <p className="text-sm text-muted-foreground/60">
                      Add Pokemon from the left to see stats
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="battle"
                className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <QuickBattleCard teamId={teamId} formatId={team.formatId} />

                  <Card className="bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <History className="w-4 h-4" /> Battle History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground text-center py-8">
                        No battles recorded yet for this team version.
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/teams/${teamId}/battles`)}
                      >
                        View Full History
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent
                value="analysis"
                className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <div className="space-y-8">
                  <WeaknessHeatmap slots={team.slots} />
                  <SpeedTiers tiers={analysis?.speedTiers} />
                  <CoverageChart coverage={analysis?.coverage} />
                </div>
              </TabsContent>

              <TabsContent
                value="matchups"
                className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <OpponentSelector
                  selectedIds={customThreatIds}
                  onSelectionChange={setCustomThreatIds}
                  formatId={team.formatId}
                />
                <MatchupMatrix
                  matrix={matchupQuery.data?.data}
                  isLoading={matchupQuery.isLoading}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Dialogs & Panels */}
        <VersionPanel
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
          teamId={teamId}
          lineageData={lineageQuery.data}
          lineageLoading={lineageQuery.isLoading}
          compareTargetId={compareTargetId}
          onCompareTargetChange={setCompareTargetId}
          compareData={compareQuery.data}
          compareLoading={compareQuery.isLoading}
          onMerge={() => setMergeOpen(true)}
          mergeDisabled={!compareTargetId || !compareQuery.data}
        />

        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-[90vw] sm:h-[90vh] flex flex-col overflow-y-auto bg-card border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display text-primary">
                {addingNew ? "Recruit Pokemon" : "Modify Specimen"}
              </DialogTitle>
              <DialogDescription>
                {addingNew
                  ? "Search the Pokedex for a new team member."
                  : "Adjust stats, moves, and items."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <SlotEditor
                slot={addingNew ? null : selectedSlotData}
                teamId={teamId}
                nextPosition={nextPosition}
                onSave={handleSaveSlot}
                onRemove={handleRemoveSlot}
                isNew={addingNew}
                formatId={team.formatId}
              />
            </div>
          </DialogContent>
        </Dialog>

        {compareQuery.data && (
          <MergeWizard
            open={mergeOpen}
            onOpenChange={setMergeOpen}
            diff={compareQuery.data}
            onMerge={handleMerge}
            isLoading={mergeTeamsMut.isPending}
          />
        )}
      </div>
    </div>
  )
}
