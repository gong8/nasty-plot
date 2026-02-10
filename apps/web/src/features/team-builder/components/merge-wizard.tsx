"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { TeamDiff, MergeDecision } from "@nasty-plot/core"

interface MergeWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  diff: TeamDiff
  onMerge: (
    decisions: MergeDecision[],
    options: { name: string; branchName?: string; notes?: string },
  ) => Promise<void>
  isLoading?: boolean
}

export function MergeWizard({ open, onOpenChange, diff, onMerge, isLoading }: MergeWizardProps) {
  const [step, setStep] = useState(0)
  const [decisions, setDecisions] = useState<MergeDecision[]>([])
  const [name, setName] = useState("")
  const [branchName, setBranchName] = useState("")
  const [notes, setNotes] = useState("")

  // Reset state when dialog opens/closes or diff changes
  useEffect(() => {
    if (open) {
      setStep(0)
      setDecisions([])
      setName(`Merge of ${diff.teamAName} + ${diff.teamBName}`)
      setBranchName("")
      setNotes("")
    }
  }, [open, diff.teamAName, diff.teamBName])

  const handleDecision = (pokemonId: string, source: "teamA" | "teamB") => {
    setDecisions((prev) => {
      const filtered = prev.filter((d) => d.pokemonId !== pokemonId)
      return [...filtered, { pokemonId, source }]
    })
  }

  const handleMerge = async () => {
    await onMerge(decisions, {
      name: name.trim(),
      branchName: branchName.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  const hasConflicts = diff.changed.length > 0 || diff.added.length > 0 || diff.removed.length > 0

  const truncate = (s: string, max = 24) => (s.length > max ? s.slice(0, max - 1) + "\u2026" : s)
  const nameA = truncate(diff.teamAName)
  const nameB = truncate(diff.teamBName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">Merge into {diff.teamAName}</DialogTitle>
          <DialogDescription>
            {step === 0 &&
              (hasConflicts
                ? `Pulling changes from ${diff.teamBName}. Choose which version to keep for each difference.`
                : `No conflicts between ${diff.teamAName} and ${diff.teamBName}. The teams are identical.`)}
            {step === 1 && "Name and finalize the merged team."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 0: Review Diff & Choose */}
        {step === 0 && (
          <div className="space-y-3">
            {/* Changed Pokemon */}
            {diff.changed.map((change) => {
              const dec = decisions.find((d) => d.pokemonId === change.pokemonId)
              return (
                <Card key={change.pokemonId}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{change.name}</span>
                      <Badge variant="outline" className="text-xs text-yellow-600">
                        {change.changes.length} change{change.changes.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {change.changes.map((fc) => (
                        <div key={fc.field}>
                          {fc.label}:{" "}
                          <span className="text-red-500 line-through">{fc.before ?? "none"}</span>{" "}
                          &rarr; <span className="text-green-500">{fc.after ?? "none"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        variant={dec?.source === "teamA" ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => handleDecision(change.pokemonId, "teamA")}
                      >
                        Keep from {nameA}
                      </Button>
                      <Button
                        variant={dec?.source === "teamB" ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => handleDecision(change.pokemonId, "teamB")}
                      >
                        Keep from {nameB}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Added Pokemon (only in B) */}
            {diff.added.map((slot) => {
              const dec = decisions.find((d) => d.pokemonId === slot.pokemonId)
              return (
                <Card key={`added-${slot.pokemonId}`} className="border-green-500/30">
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{slot.species?.name ?? slot.pokemonId}</span>
                      <Badge variant="outline" className="text-xs text-green-600">
                        New in {nameB}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={dec?.source === "teamB" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDecision(slot.pokemonId, "teamB")}
                      >
                        Include
                      </Button>
                      <Button
                        variant={!dec ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setDecisions((prev) => prev.filter((d) => d.pokemonId !== slot.pokemonId))
                        }
                      >
                        Exclude
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Removed Pokemon (only in A) */}
            {diff.removed.map((slot) => {
              const dec = decisions.find((d) => d.pokemonId === slot.pokemonId)
              return (
                <Card key={`removed-${slot.pokemonId}`} className="border-red-500/30">
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{slot.species?.name ?? slot.pokemonId}</span>
                      <Badge variant="outline" className="text-xs text-red-600">
                        Removed in {nameB}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={dec?.source === "teamA" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDecision(slot.pokemonId, "teamA")}
                      >
                        Keep
                      </Button>
                      <Button
                        variant={!dec ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setDecisions((prev) => prev.filter((d) => d.pokemonId !== slot.pokemonId))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {diff.unchanged.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {diff.unchanged.length} unchanged Pokemon will be included automatically.
              </p>
            )}

            <DialogFooter>
              <Button onClick={() => setStep(1)} disabled={!hasConflicts}>
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 1: Name & Confirm */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Merged Team Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Branch Label</label>
              <Input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g., best-of-both"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={3}
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={handleMerge} disabled={!name.trim() || isLoading}>
                {isLoading ? "Merging..." : "Create Merged Team"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
