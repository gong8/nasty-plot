"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/EmptyState"
import { DataStateRenderer } from "@/components/DataStateRenderer"
import { SampleTeamCard } from "@/features/battle/components/SampleTeamCard"
import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import type { FormatDefinition } from "@nasty-plot/core"
import type { SampleTeamData } from "@nasty-plot/teams"
import { useFetchData } from "@/lib/hooks/use-fetch-data"

/** SampleTeam as returned by the API (createdAt serialized to string) */
type SampleTeam = Omit<SampleTeamData, "createdAt"> & { createdAt: string }

const ARCHETYPE_OPTIONS = [
  { value: "all", label: "All Archetypes" },
  { value: "hyper-offense", label: "Hyper Offense" },
  { value: "offense", label: "Offense" },
  { value: "balance", label: "Balance" },
  { value: "bulky-offense", label: "Bulky Offense" },
  { value: "stall", label: "Stall" },
  { value: "rain", label: "Rain" },
  { value: "sun", label: "Sun" },
  { value: "sand", label: "Sand" },
  { value: "trick-room", label: "Trick Room" },
]

export default function SampleTeamsPage() {
  const router = useRouter()
  const [formatId, setFormatId] = useState("all")
  const [archetype, setArchetype] = useState("all")
  const [search, setSearch] = useState("")

  const { data: formatsResponse } = useFetchData<{ data: FormatDefinition[] }>("/api/formats")
  const formatOptions = [
    { value: "all", label: "All Formats" },
    ...(formatsResponse?.data
      ?.filter((f) => f.isActive)
      .map((f) => ({ value: f.id, label: f.name })) ?? []),
  ]

  const sampleTeamsParams = new URLSearchParams()
  if (formatId !== "all") sampleTeamsParams.set("formatId", formatId)
  if (archetype !== "all") sampleTeamsParams.set("archetype", archetype)
  if (search) sampleTeamsParams.set("search", search)
  const sampleTeamsUrl = `/api/sample-teams?${sampleTeamsParams}`
  const { data: teamsResponse, loading } = useFetchData<{ data: SampleTeam[] }>(sampleTeamsUrl)
  const teams = teamsResponse?.data ?? null

  const handleUseInBattle = (paste: string) => {
    const params = new URLSearchParams({
      samplePaste: btoa(encodeURIComponent(paste)),
    })
    router.push(`/battle/new?${params.toString()}`)
  }

  return (
    <main className="container mx-auto p-4 max-w-5xl">
      <div className="mb-6">
        <Link href="/battle">
          <Button variant="ghost" size="sm" className="gap-1.5 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Battle Hub
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-display">Sample Teams</h1>
        <p className="text-muted-foreground text-sm">
          Browse curated teams and use them in battle.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <Label className="text-xs sr-only">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or Pokemon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs sr-only">Format</Label>
          <Select value={formatId} onValueChange={setFormatId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Formats" />
            </SelectTrigger>
            <SelectContent>
              {formatOptions.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs sr-only">Archetype</Label>
          <Select value={archetype} onValueChange={setArchetype}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Archetypes" />
            </SelectTrigger>
            <SelectContent>
              {ARCHETYPE_OPTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team grid */}
      <DataStateRenderer
        data={teams}
        loading={loading}
        isEmpty={(d) => d.length === 0}
        loadingContent={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl border bg-muted/50 animate-pulse" />
            ))}
          </div>
        }
        emptyContent={<EmptyState>No sample teams found. Try adjusting your filters.</EmptyState>}
      >
        {(teams) => (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <SampleTeamCard
                key={team.id}
                name={team.name}
                pokemonIds={team.pokemonIds}
                archetype={team.archetype}
                source={team.source}
                paste={team.paste}
                onUse={handleUseInBattle}
              />
            ))}
          </div>
        )}
      </DataStateRenderer>
    </main>
  )
}
