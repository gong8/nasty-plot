"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/features/teams/hooks/use-teams";
import { GuidedBuilder } from "@/features/team-builder/components/guided-builder";

export default function GuidedBuilderPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const router = useRouter();
  const teamQuery = useTeam(teamId);

  if (teamQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (teamQuery.error || !teamQuery.data) {
    return (
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Team not found</h2>
          <p className="text-muted-foreground mt-2">
            The team you are looking for does not exist or was deleted.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/teams")}
          >
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  const team = teamQuery.data;

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/teams/${teamId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{team.name}</h1>
            <p className="text-sm text-muted-foreground">
              Guided Team Builder &middot; {team.formatId}
            </p>
          </div>
        </div>
{/* Freeform switch is in the GuidedBuilder footer (saves state before navigating) */}
      </div>

      {/* Guided builder wizard */}
      <GuidedBuilder teamId={teamId} formatId={team.formatId} />
    </div>
  );
}
