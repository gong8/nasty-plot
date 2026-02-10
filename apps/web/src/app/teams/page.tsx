"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Users, ArchiveRestore, GitFork } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { PokemonSprite } from "@nasty-plot/ui"
import { useTeams, useRestoreTeam } from "@/features/teams/hooks/use-teams"

export default function TeamsPage() {
  const router = useRouter()
  const [showArchived, setShowArchived] = useState(false)
  const { data: teams, isLoading } = useTeams(undefined, showArchived)
  const restoreMut = useRestoreTeam()

  return (
    <div className="flex flex-col">
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold font-display">My Teams</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Every great scheme starts with a roster
            </p>
          </div>
          <Button onClick={() => router.push("/teams/new")}>
            <Plus className="h-4 w-4 mr-2" /> New Team
          </Button>
        </div>

        {/* Archive Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
          <label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
            Show archived teams
          </label>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
                alt="Pecharunt"
                width={48}
                height={48}
                className="pixelated mx-auto mb-2"
              />
              <Users className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No teams yet</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Pecharunt is waiting for your first team. Create one to get started.
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
                className={`cursor-pointer transition-all hover:shadow-md dark:hover:shadow-[0_0_20px_var(--color-glow-primary)] ${
                  team.isArchived ? "opacity-60" : ""
                }`}
                onClick={() => router.push(`/teams/${team.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {team.isArchived && (
                      <span className="line-through text-muted-foreground">{team.name}</span>
                    )}
                    {!team.isArchived && team.name}
                    {team.parentId && <GitFork className="h-3.5 w-3.5 text-muted-foreground" />}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {team.formatId}
                    </Badge>
                    {team.branchName && (
                      <Badge variant="outline" className="text-xs">
                        {team.branchName}
                      </Badge>
                    )}
                    {team.isArchived && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Archived
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{team.slots.length}/6 Pokemon</span>
                    <div className="flex items-center gap-2">
                      {team.isArchived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            restoreMut.mutate(team.id)
                          }}
                        >
                          <ArchiveRestore className="h-3 w-3 mr-1" /> Restore
                        </Button>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {new Date(team.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {team.slots.length > 0 && (
                    <div className="flex gap-1 mt-3">
                      {team.slots.map((slot) => (
                        <div key={slot.position} title={slot.species?.name || slot.pokemonId}>
                          {slot.species?.num ? (
                            <PokemonSprite
                              pokemonId={slot.pokemonId}
                              num={slot.species.num}
                              size={32}
                            />
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
  )
}
