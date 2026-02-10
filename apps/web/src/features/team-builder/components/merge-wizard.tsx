"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  TeamData,
  TeamDiff,
  MergeDecision,
} from "@nasty-plot/core";

interface MergeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamData[];
  diff: TeamDiff | null;
  onSelectTeams: (teamAId: string, teamBId: string) => void;
  onMerge: (decisions: MergeDecision[], options: { name: string; branchName?: string; notes?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function MergeWizard({
  open,
  onOpenChange,
  teams,
  diff,
  onSelectTeams,
  onMerge,
  isLoading,
}: MergeWizardProps) {
  const [step, setStep] = useState(0);
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [decisions, setDecisions] = useState<MergeDecision[]>([]);
  const [name, setName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [notes, setNotes] = useState("");

  const handleReset = () => {
    setStep(0);
    setTeamAId("");
    setTeamBId("");
    setDecisions([]);
    setName("");
    setBranchName("");
    setNotes("");
  };

  const handleSelectTeams = () => {
    if (!teamAId || !teamBId) return;
    onSelectTeams(teamAId, teamBId);
    const teamA = teams.find((t) => t.id === teamAId);
    const teamB = teams.find((t) => t.id === teamBId);
    setName(`Merge of ${teamA?.name ?? "A"} + ${teamB?.name ?? "B"}`);
    setStep(1);
  };

  const handleDecision = (pokemonId: string, source: "teamA" | "teamB") => {
    setDecisions((prev) => {
      const filtered = prev.filter((d) => d.pokemonId !== pokemonId);
      return [...filtered, { pokemonId, source }];
    });
  };

  const handleMerge = async () => {
    await onMerge(decisions, {
      name: name.trim(),
      branchName: branchName.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    handleReset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) handleReset();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge Teams</DialogTitle>
          <DialogDescription>
            {step === 0 && "Select two teams to merge."}
            {step === 1 && "Choose which version to keep for each differing Pokemon."}
            {step === 2 && "Name and finalize the merged team."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 0: Select Teams */}
        {step === 0 && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Team A (base)</label>
              <select
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === teamBId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Team B (merge from)</label>
              <select
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === teamAId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button onClick={handleSelectTeams} disabled={!teamAId || !teamBId}>
                Compare
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 1: Review Diff & Choose */}
        {step === 1 && diff && (
          <div className="space-y-3">
            {/* Changed Pokemon */}
            {diff.changed.map((change) => {
              const dec = decisions.find((d) => d.pokemonId === change.pokemonId);
              return (
                <Card key={change.pokemonId}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{change.name}</span>
                      <Badge variant="outline" className="text-xs text-yellow-600">
                        {change.changes.length} change{change.changes.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={dec?.source === "teamA" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDecision(change.pokemonId, "teamA")}
                      >
                        Keep from {diff.teamAName}
                      </Button>
                      <Button
                        variant={dec?.source === "teamB" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDecision(change.pokemonId, "teamB")}
                      >
                        Keep from {diff.teamBName}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Added Pokemon (only in B) */}
            {diff.added.map((slot) => {
              const dec = decisions.find((d) => d.pokemonId === slot.pokemonId);
              return (
                <Card key={`added-${slot.pokemonId}`} className="border-green-500/30">
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{slot.species?.name ?? slot.pokemonId}</span>
                      <Badge variant="outline" className="text-xs text-green-600">
                        New in {diff.teamBName}
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
                          setDecisions((prev) =>
                            prev.filter((d) => d.pokemonId !== slot.pokemonId),
                          )
                        }
                      >
                        Exclude
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Removed Pokemon (only in A) */}
            {diff.removed.map((slot) => {
              const dec = decisions.find((d) => d.pokemonId === slot.pokemonId);
              return (
                <Card key={`removed-${slot.pokemonId}`} className="border-red-500/30">
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{slot.species?.name ?? slot.pokemonId}</span>
                      <Badge variant="outline" className="text-xs text-red-600">
                        Removed in {diff.teamBName}
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
                          setDecisions((prev) =>
                            prev.filter((d) => d.pokemonId !== slot.pokemonId),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {diff.unchanged.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {diff.unchanged.length} unchanged Pokemon will be included automatically.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={() => setStep(2)}>
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Name & Confirm */}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Merged Team Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
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
              <Button variant="outline" onClick={() => setStep(1)}>
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
  );
}
