"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react"
import { useTeams } from "@/features/teams/hooks/use-teams"
import { useSampleTeams } from "../hooks/use-sample-teams"
import { TeamPickerCard } from "./TeamPickerCard"
import type { GameType } from "@nasty-plot/core"
import type { TeamValidation } from "../types"

export interface TeamSelection {
  teamId: string | null
  paste: string
  source: "saved" | "sample" | "paste"
}

interface TeamPickerProps {
  label: string
  formatId: string
  gameType: GameType
  selection: TeamSelection
  onSelectionChange: (selection: TeamSelection) => void
  validation?: TeamValidation
}

export function TeamPicker({
  label,
  formatId,
  gameType,
  selection,
  onSelectionChange,
  validation,
}: TeamPickerProps) {
  const [pasteExpanded, setPasteExpanded] = useState(false)
  const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null)

  const { data: teams = [], isLoading: teamsLoading } = useTeams()
  const { data: sampleTeams = [], isLoading: samplesLoading } = useSampleTeams(formatId)

  // Filter saved teams by compatible gameType
  // Singles teams work across singles formats, doubles across doubles
  const compatibleTeams = teams.filter((t) => {
    // If the team has a format, check if its gameType matches
    if (t.format) return t.format.gameType === gameType
    // Fallback: check format ID patterns for doubles
    const isDoublesFormat = t.formatId.includes("doubles") || t.formatId.includes("vgc")
    return gameType === "doubles" ? isDoublesFormat : !isDoublesFormat
  })

  const handleSelectSaved = async (teamId: string) => {
    setLoadingTeamId(teamId)
    try {
      const res = await fetch(`/api/teams/${teamId}/export`)
      if (!res.ok) throw new Error("Failed to load team")
      const paste = await res.text()
      onSelectionChange({ teamId, paste, source: "saved" })
    } catch {
      // Silently fail - user can paste manually
    } finally {
      setLoadingTeamId(null)
    }
  }

  const handleSelectSample = (sampleTeam: { paste: string }) => {
    onSelectionChange({ teamId: null, paste: sampleTeam.paste, source: "sample" })
  }

  const handlePasteChange = (paste: string) => {
    onSelectionChange({ teamId: null, paste, source: "paste" })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{label}</Label>
        {validation &&
          selection.paste.trim() &&
          (validation.valid ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {validation.pokemonCount} Pokemon ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Invalid team
            </span>
          ))}
      </div>

      <Tabs defaultValue="saved">
        <TabsList variant="default" className="w-full">
          <TabsTrigger value="saved">My Teams</TabsTrigger>
          <TabsTrigger value="sample">Sample Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="saved" className="mt-3">
          {teamsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : compatibleTeams.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <p>No saved teams yet</p>
              <a
                href="/teams/new"
                className="text-primary hover:underline text-xs mt-1 inline-block"
              >
                Create a team
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {compatibleTeams.map((t) => (
                <div key={t.id} className="relative">
                  <TeamPickerCard
                    team={{
                      id: t.id,
                      name: t.name,
                      source: "saved",
                      pokemonIds: t.slots.map((s) => s.pokemonId),
                    }}
                    selected={selection.teamId === t.id && selection.source === "saved"}
                    onSelect={() => handleSelectSaved(t.id)}
                  />
                  {loadingTeamId === t.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sample" className="mt-3">
          {samplesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : sampleTeams.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No sample teams for this format
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {sampleTeams.map((st) => (
                <TeamPickerCard
                  key={st.id}
                  team={{
                    id: st.id,
                    name: st.name,
                    source: "sample",
                    archetype: st.archetype,
                    pokemonIds: st.pokemonIds.split(",").filter(Boolean),
                  }}
                  selected={selection.paste === st.paste && selection.source === "sample"}
                  onSelect={() => handleSelectSample(st)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Collapsible paste section */}
      <div className="border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs text-muted-foreground"
          onClick={() => setPasteExpanded(!pasteExpanded)}
        >
          Or paste a team manually
          {pasteExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        {pasteExpanded && (
          <Textarea
            value={selection.paste}
            onChange={(e) => handlePasteChange(e.target.value)}
            placeholder="Paste your team in Showdown format..."
            className="font-mono text-xs min-h-[150px] mt-2"
          />
        )}
      </div>
    </div>
  )
}
