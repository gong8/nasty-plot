"use client";

import { Sparkles, ArrowRight, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SampleTeamEntry } from "../../hooks/use-guided-builder";

interface StepStartProps {
  sampleTeams: SampleTeamEntry[];
  isLoading: boolean;
  onStartFromScratch: () => void;
  onImportSample: (team: SampleTeamEntry) => void;
}

export function StepStart({
  sampleTeams,
  isLoading,
  onStartFromScratch,
  onImportSample,
}: StepStartProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Start from Scratch */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Start from Scratch
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Build your team from the ground up. We'll guide you through picking
            Pokemon one at a time, with recommendations at every step.
          </p>
          <Button onClick={onStartFromScratch} className="w-full">
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Start from a Sample Team */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Start from a Sample Team
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Start with a proven team and make it your own. Browse popular teams
            for your format, then customize the sets.
          </p>

          <div className="space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </>
            ) : sampleTeams.length > 0 ? (
              sampleTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onImportSample(team)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3",
                    "bg-muted/50 text-left transition-colors",
                    "hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.pokemonIds.length} Pokemon
                    </p>
                  </div>
                  {team.archetype && (
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {team.archetype}
                    </Badge>
                  )}
                </button>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No sample teams available for this format
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
