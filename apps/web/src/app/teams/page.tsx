"use client";

import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/site-header";
import { PokemonSprite } from "@nasty-plot/ui";
import { useTeams } from "@/features/teams/hooks/use-teams";

export default function TeamsPage() {
  const router = useRouter();
  const { data: teams, isLoading } = useTeams();

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="container mx-auto max-w-5xl py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Teams</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Build and manage your competitive Pokemon teams
          </p>
        </div>
        <Button onClick={() => router.push("/teams/new")}>
          <Plus className="h-4 w-4 mr-2" /> New Team
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && teams && teams.length === 0 && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No teams yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Create your first team to get started building
              </p>
            </div>
            <Button onClick={() => router.push("/teams/new")}>
              <Plus className="h-4 w-4 mr-2" /> Create Team
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && teams && teams.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => router.push(`/teams/${team.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-base">{team.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {team.formatId}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {team.slots.length}/6 Pokemon
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(team.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {team.slots.length > 0 && (
                  <div className="flex gap-1 mt-3">
                    {team.slots.map((slot) => (
                      <div key={slot.position} title={slot.species?.name || slot.pokemonId}>
                        {slot.species?.num ? (
                          <PokemonSprite pokemonId={slot.pokemonId} num={slot.species.num} size={32} />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[8px] font-bold uppercase">
                            {slot.pokemonId.slice(0, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
