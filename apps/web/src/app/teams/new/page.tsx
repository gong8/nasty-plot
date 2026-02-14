"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@nasty-plot/ui"
import { DEFAULT_FORMAT_ID } from "@nasty-plot/core"
import { useCreateTeam } from "@/features/teams/hooks/use-teams"
import { getActiveFormats } from "@nasty-plot/formats"

const COMMON_FORMATS = getActiveFormats().map((f) => ({
  id: f.id,
  name: f.name,
}))

type BuilderMode = "freeform" | "guided"

export default function NewTeamPage() {
  const router = useRouter()
  const createTeam = useCreateTeam()
  const [name, setName] = useState("")
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT_ID)
  const [mode, setMode] = useState<BuilderMode>("freeform")

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      const team = await createTeam.mutateAsync({
        name: name.trim(),
        formatId,
        mode,
      })
      const destination = mode === "guided" ? `/teams/${team.id}/guided` : `/teams/${team.id}`
      router.push(destination)
    } catch {
      // Error handled by mutation state
    }
  }

  return (
    <div className="container mx-auto max-w-md py-8 px-4 space-y-4">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.push("/teams")}>
        <ArrowLeft className="h-4 w-4" />
        Back to Teams
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Create New Team</CardTitle>
          <CardDescription>Name it, pick a format, choose your approach.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              placeholder="e.g. Rain Offense"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Select value={formatId} onValueChange={setFormatId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_FORMATS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Builder mode toggle */}
          <div className="space-y-2">
            <Label>Builder Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-all",
                  mode === "freeform"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
                onClick={() => setMode("freeform")}
              >
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Freeform</p>
                  <p className="text-xs text-muted-foreground">Pick Pokemon manually</p>
                </div>
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-all",
                  mode === "guided"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
                onClick={() => setMode("guided")}
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Guided</p>
                  <p className="text-xs text-muted-foreground">Step-by-step with recommendations</p>
                </div>
              </button>
            </div>
            {mode === "guided" && (
              <p className="text-xs text-muted-foreground mt-1">
                Start from scratch or from a sample team. Recommendations and analysis at every
                step.
              </p>
            )}
          </div>

          {createTeam.isError && (
            <p className="text-sm text-destructive">
              {createTeam.error?.message || "Failed to create team"}
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!name.trim() || createTeam.isPending}
          >
            {createTeam.isPending ? "Pecharunt is scheming..." : "Create Team"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
