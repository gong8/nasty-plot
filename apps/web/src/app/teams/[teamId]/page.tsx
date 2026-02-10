"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTeamBuilder } from "@/features/team-builder/hooks/use-team-builder";
import {
  useUpdateTeam,
  useDeleteTeam,
  useAddSlot,
  useUpdateSlot,
  useRemoveSlot,
  useForkTeam,
  useCompareTeams,
  useLineageTree,
} from "@/features/teams/hooks/use-teams";
import { TeamHeader } from "@/features/team-builder/components/team-header";
import { TeamGrid } from "@/features/team-builder/components/team-grid";
import { SlotEditor } from "@/features/team-builder/components/slot-editor";
import { CoverageChart } from "@/features/analysis/components/coverage-chart";
import { WeaknessHeatmap } from "@/features/analysis/components/weakness-heatmap";
import { ThreatList } from "@/features/analysis/components/threat-list";
import { SpeedTiers } from "@/features/analysis/components/speed-tiers";
import { MatchupMatrix } from "@/features/damage-calc/components/matchup-matrix";
import { RecommendationPanel } from "@/features/recommendations/components/recommendation-panel";
import { TeamDiffView } from "@/features/team-builder/components/team-diff-view";
import { LineageTree } from "@/features/team-builder/components/lineage-tree";
import type { TeamSlotInput, TeamAnalysis, MatchupMatrixEntry, LineageNode } from "@nasty-plot/core";

function collectNodes(node: LineageNode): LineageNode[] {
  return [node, ...node.children.flatMap(collectNodes)];
}

export default function TeamEditorPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const router = useRouter();
  const {
    team,
    isLoading,
    error,
    selectedSlot,
    selectedSlotData,
    selectSlot,
    refetch,
  } = useTeamBuilder(teamId);

  const [addingNew, setAddingNew] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [compareTargetId, setCompareTargetId] = useState<string | undefined>();

  const updateTeamMut = useUpdateTeam();
  const deleteTeamMut = useDeleteTeam();
  const addSlotMut = useAddSlot();
  const updateSlotMut = useUpdateSlot();
  const removeSlotMut = useRemoveSlot();
  const forkTeamMut = useForkTeam();
  const lineageQuery = useLineageTree(teamId);
  const compareQuery = useCompareTeams(
    compareTargetId ? teamId : undefined,
    compareTargetId,
  );

  // Fetch analysis data when analysis tab is selected and team has slots
  const analysisQuery = useQuery<{ data: TeamAnalysis }>({
    queryKey: ["team-analysis", teamId],
    queryFn: () =>
      fetch(`/api/teams/${teamId}/analysis`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch analysis");
        return r.json();
      }),
    enabled: activeTab === "analysis" && !!team && team.slots.length > 0,
  });

  // Fetch matchup matrix when matchups tab is selected
  const matchupQuery = useQuery<{ data: MatchupMatrixEntry[][] }>({
    queryKey: ["matchup-matrix", teamId, team?.formatId],
    queryFn: () =>
      fetch("/api/damage-calc/matchup-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          formatId: team?.formatId,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch matchup matrix");
        return r.json();
      }),
    enabled: activeTab === "matchups" && !!team && team.slots.length > 0,
  });

  const handleFork = useCallback(
    async (options: { name: string; branchName?: string; notes?: string }) => {
      const forked = await forkTeamMut.mutateAsync({
        teamId,
        options,
      });
      router.push(`/teams/${forked.id}`);
    },
    [teamId, forkTeamMut, router],
  );

  const handleUpdateName = useCallback(
    (name: string) => {
      updateTeamMut.mutate({ teamId, data: { name } });
    },
    [teamId, updateTeamMut]
  );

  const handleDelete = useCallback(async () => {
    await deleteTeamMut.mutateAsync(teamId);
    router.push("/teams");
  }, [teamId, deleteTeamMut, router]);

  const handleImport = useCallback(
    async (paste: string) => {
      if (!team) return;
      const res = await fetch(`/api/teams/${teamId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paste }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Import failed");
      }
      await refetch();
    },
    [team, teamId, refetch]
  );

  const handleAddSlot = useCallback(() => {
    setAddingNew(true);
    selectSlot(null);
  }, [selectSlot]);

  const handleSaveSlot = useCallback(
    async (data: TeamSlotInput) => {
      if (addingNew) {
        await addSlotMut.mutateAsync({ teamId, slot: data });
        setAddingNew(false);
      } else if (selectedSlot !== null) {
        await updateSlotMut.mutateAsync({
          teamId,
          position: selectedSlot,
          data,
        });
      }
    },
    [teamId, addingNew, selectedSlot, addSlotMut, updateSlotMut]
  );

  const handleRemoveSlot = useCallback(async () => {
    if (selectedSlot === null) return;
    await removeSlotMut.mutateAsync({ teamId, position: selectedSlot });
    selectSlot(null);
  }, [teamId, selectedSlot, removeSlotMut, selectSlot]);

  const handleSelectSlot = useCallback(
    (position: number) => {
      setAddingNew(false);
      selectSlot(position);
    },
    [selectSlot]
  );

  const dialogOpen = selectedSlot !== null || addingNew;
  const handleDialogClose = useCallback(
    (open: boolean) => {
      if (!open) {
        selectSlot(null);
        setAddingNew(false);
      }
    },
    [selectSlot]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))}
        </div>
      </div>
    );
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
    );
  }

  const nextPosition = team.slots.length + 1;
  const analysis = analysisQuery.data?.data;

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
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
          />
        </div>
      </div>

      {/* Team Grid */}
      <TeamGrid
        team={team}
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
        onAddSlot={handleAddSlot}
      />

      {/* Add Pokemon Button */}
      {team.slots.length < 6 && (
        <Button
          onClick={handleAddSlot}
          variant="outline"
          className="w-full border-dashed"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Pokemon ({team.slots.length}/6)
        </Button>
      )}

      {/* Recommendations */}
      {team.slots.length >= 1 && team.slots.length <= 5 && (
        <RecommendationPanel
          teamId={teamId}
          formatId={team.formatId}
          currentSlotCount={team.slots.length}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="matchups">Matchups</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="lineage">Lineage</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="py-4">
          <div className="text-center text-muted-foreground py-8">
            {team.slots.length === 0
              ? "Add Pokemon to begin your analysis"
              : `${team.slots.length}/6 Pokemon selected`}
          </div>
        </TabsContent>
        <TabsContent value="matchups" className="py-4">
          <MatchupMatrix
            matrix={matchupQuery.data?.data}
            isLoading={matchupQuery.isLoading}
          />
        </TabsContent>
        <TabsContent value="analysis" className="py-4">
          {team.slots.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Add Pokemon to your team to see analysis
            </div>
          ) : (
            <div className="space-y-4">
              <CoverageChart coverage={analysis?.coverage} />
              <WeaknessHeatmap slots={team.slots} />
              <ThreatList
                threats={analysis?.threats}
                isLoading={analysisQuery.isLoading}
              />
              <SpeedTiers tiers={analysis?.speedTiers} />
            </div>
          )}
        </TabsContent>
        <TabsContent value="lineage" className="py-4">
          {lineageQuery.data ? (
            <LineageTree tree={lineageQuery.data} currentTeamId={teamId} />
          ) : lineageQuery.isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading lineage...
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No lineage data. Fork this team to start tracking variants.
            </div>
          )}
        </TabsContent>
        <TabsContent value="compare" className="py-4 space-y-4">
          {lineageQuery.data && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Compare with:</label>
              <select
                value={compareTargetId ?? ""}
                onChange={(e) => setCompareTargetId(e.target.value || undefined)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select a team...</option>
                {collectNodes(lineageQuery.data)
                  .filter((n) => n.teamId !== teamId)
                  .map((n) => (
                    <option key={n.teamId} value={n.teamId}>
                      {n.name}
                      {n.branchName ? ` (${n.branchName})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}
          {compareQuery.data && <TeamDiffView diff={compareQuery.data} />}
          {compareQuery.isLoading && (
            <div className="text-center text-muted-foreground py-8">
              Comparing teams...
            </div>
          )}
          {!compareTargetId && (
            <div className="text-center text-muted-foreground py-8">
              Select a team from the lineage to compare changes.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Slot Editor Dialog (full-screen) */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[90vw] sm:h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {addingNew ? "Add Pokemon" : "Edit Pokemon"}
            </DialogTitle>
            <DialogDescription>
              {addingNew
                ? "Search and add a Pokemon to your team"
                : "Edit this Pokemon's set"}
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

    </div>
  );
}
