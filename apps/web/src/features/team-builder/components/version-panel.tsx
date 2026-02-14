"use client"

import type { LineageNode, TeamDiff } from "@nasty-plot/core"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { LoadingSpinner } from "@/components/loading-spinner"
import { LineageTree } from "./lineage-tree"
import { TeamDiffView } from "./team-diff-view"

interface VersionPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  lineageData: LineageNode | undefined
  lineageLoading: boolean
  compareTargetId: string | undefined
  onCompareTargetChange: (id: string | undefined) => void
  compareData: TeamDiff | undefined
  compareLoading: boolean
  onMerge: () => void
  mergeDisabled: boolean
}

function collectNodes(node: LineageNode): LineageNode[] {
  return [node, ...node.children.flatMap(collectNodes)]
}

export function VersionPanel({
  open,
  onOpenChange,
  teamId,
  lineageData,
  lineageLoading,
  compareTargetId,
  onCompareTargetChange,
  compareData,
  compareLoading,
  onMerge,
  mergeDisabled,
}: VersionPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Versions</DialogTitle>
          <DialogDescription>Team history and comparisons</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto pr-4">
          {/* Section 1: History */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">History</h3>
            {lineageLoading ? (
              <LoadingSpinner size="sm" label="Loading lineage..." />
            ) : lineageData ? (
              <LineageTree tree={lineageData} currentTeamId={teamId} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No lineage data. Fork this team to start tracking variants.
              </p>
            )}
          </div>

          <Separator className="my-4" />

          {/* Section 2: Compare */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Compare</h3>

            <select
              value={compareTargetId ?? ""}
              onChange={(e) => onCompareTargetChange(e.target.value || undefined)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm w-full"
            >
              <option value="">Select a team...</option>
              {lineageData &&
                collectNodes(lineageData)
                  .filter((n) => n.teamId !== teamId)
                  .map((n) => (
                    <option key={n.teamId} value={n.teamId}>
                      {n.name}
                      {n.branchName ? ` (${n.branchName})` : ""}
                    </option>
                  ))}
            </select>

            {compareLoading && <LoadingSpinner size="sm" label="Comparing teams..." />}

            {compareData && <TeamDiffView diff={compareData} />}

            <Button onClick={onMerge} disabled={mergeDisabled || !compareData} className="w-full">
              Merge
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
