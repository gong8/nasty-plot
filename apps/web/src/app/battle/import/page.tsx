"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Link as LinkIcon, FileText, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useBattleImport, type ImportResult } from "@/features/battle/hooks/use-battle-import"

function isValidReplayUrl(url: string): boolean {
  return /replay\.pokemonshowdown\.com\/[a-z0-9-]+/i.test(url)
}

function TeamMatchBadge({ action }: { action: string }) {
  if (action === "matched") return <Badge className="bg-green-600">Matched</Badge>
  if (action === "created") return <Badge className="bg-blue-600">Created</Badge>
  return <Badge variant="secondary">Skipped</Badge>
}

export default function BattleImportPage() {
  const router = useRouter()
  const importMut = useBattleImport()

  const [replayUrl, setReplayUrl] = useState("")
  const [rawLog, setRawLog] = useState("")
  const [inferSets, setInferSets] = useState(true)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleImportUrl = async () => {
    if (!replayUrl.trim() || !isValidReplayUrl(replayUrl)) return
    try {
      const data = await importMut.mutateAsync({ replayUrl: replayUrl.trim(), inferSets })
      setResult(data)
    } catch {
      // Error handled by mutation state
    }
  }

  const handleImportLog = async () => {
    if (!rawLog.trim()) return
    try {
      const data = await importMut.mutateAsync({ rawLog: rawLog.trim(), inferSets })
      setResult(data)
    } catch {
      // Error handled by mutation state
    }
  }

  if (result) {
    const { battle, teamMatching } = result
    return (
      <main className="container mx-auto p-4 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setResult(null)
              setReplayUrl("")
              setRawLog("")
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Import Successful</h1>
        </div>

        <Card>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-semibold">Battle Imported</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Format</span>
                <p className="font-medium">{battle.formatId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Turns</span>
                <p className="font-medium">{battle.turnCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Player 1</span>
                <p className="font-medium">{battle.team1Name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Player 2</span>
                <p className="font-medium">{battle.team2Name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Winner</span>
                <p className="font-medium">
                  {battle.winnerId === "p1"
                    ? battle.team1Name
                    : battle.winnerId === "p2"
                      ? battle.team2Name
                      : battle.winnerId === "draw"
                        ? "Draw"
                        : "Unknown"}
                </p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">Team Matching</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Team 1:</span>
                    <TeamMatchBadge action={teamMatching.team1.action} />
                  </div>
                  {teamMatching.team1.teamName && (
                    <p className="text-xs">{teamMatching.team1.teamName}</p>
                  )}
                  {teamMatching.team1.confidence != null && (
                    <p className="text-xs text-muted-foreground">
                      {teamMatching.team1.confidence}% confidence
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Team 2:</span>
                    <TeamMatchBadge action={teamMatching.team2.action} />
                  </div>
                  {teamMatching.team2.teamName && (
                    <p className="text-xs">{teamMatching.team2.teamName}</p>
                  )}
                  {teamMatching.team2.confidence != null && (
                    <p className="text-xs text-muted-foreground">
                      {teamMatching.team2.confidence}% confidence
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => router.push(`/battle/replay/${battle.id}`)}>
                View Replay
              </Button>
              {battle.team1Id && (
                <Button variant="outline" onClick={() => router.push(`/teams/${battle.team1Id}`)}>
                  Go to Team 1
                </Button>
              )}
              {battle.team2Id && (
                <Button variant="outline" onClick={() => router.push(`/teams/${battle.team2Id}`)}>
                  Go to Team 2
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/battle")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Import Battle</h1>
      </div>

      <Tabs defaultValue="url">
        <TabsList className="w-full">
          <TabsTrigger value="url" className="flex-1 gap-2">
            <LinkIcon className="h-4 w-4" /> Showdown Replay URL
          </TabsTrigger>
          <TabsTrigger value="log" className="flex-1 gap-2">
            <FileText className="h-4 w-4" /> Raw Log Paste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium">Replay URL</label>
            <Input
              placeholder="https://replay.pokemonshowdown.com/gen9ou-12345"
              value={replayUrl}
              onChange={(e) => setReplayUrl(e.target.value)}
              className="mt-1"
            />
            {replayUrl && !isValidReplayUrl(replayUrl) && (
              <p className="text-xs text-destructive mt-1">
                Enter a valid replay.pokemonshowdown.com URL
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="infer-sets-url" checked={inferSets} onCheckedChange={setInferSets} />
            <Label htmlFor="infer-sets-url" className="text-sm">
              Infer full sets from Smogon data
            </Label>
          </div>
          <Button
            onClick={handleImportUrl}
            disabled={!replayUrl.trim() || !isValidReplayUrl(replayUrl) || importMut.isPending}
            className="w-full"
          >
            {importMut.isPending ? "Importing..." : "Import Replay"}
          </Button>
        </TabsContent>

        <TabsContent value="log" className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium">Protocol Log</label>
            <Textarea
              placeholder="Paste raw battle protocol log here..."
              value={rawLog}
              onChange={(e) => setRawLog(e.target.value)}
              rows={12}
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="infer-sets-log" checked={inferSets} onCheckedChange={setInferSets} />
            <Label htmlFor="infer-sets-log" className="text-sm">
              Infer full sets from Smogon data
            </Label>
          </div>
          <Button
            onClick={handleImportLog}
            disabled={!rawLog.trim() || importMut.isPending}
            className="w-full"
          >
            {importMut.isPending ? "Importing..." : "Import Log"}
          </Button>
        </TabsContent>
      </Tabs>

      {importMut.error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{importMut.error.message}</p>
        </div>
      )}
    </main>
  )
}
