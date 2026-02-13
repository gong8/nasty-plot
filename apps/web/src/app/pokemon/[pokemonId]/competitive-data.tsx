"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UsageStatsEntry, SmogonSetData } from "@nasty-plot/core"

interface FormatUsage {
  formatId: string
  formatName: string
  stats: UsageStatsEntry | null
}

interface CompetitiveDataProps {
  usageByFormat: FormatUsage[]
  setsByFormat: { formatId: string; formatName: string; sets: SmogonSetData[] }[]
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function SetCard({ set }: { set: SmogonSetData }) {
  const evEntries = Object.entries(set.evs).filter(([, v]) => v !== undefined && v > 0) as [
    string,
    number,
  ][]
  const ivEntries = set.ivs
    ? (Object.entries(set.ivs).filter(([, v]) => v !== undefined && v < 31) as [string, number][])
    : []

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-semibold text-sm">{set.setName}</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">Ability: </span>
          <span>{set.ability}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Item: </span>
          <span>{set.item}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Nature: </span>
          <span>{set.nature}</span>
        </div>
        {set.teraType && (
          <div>
            <span className="text-muted-foreground">Tera Type: </span>
            <span>{set.teraType}</span>
          </div>
        )}
      </div>
      <div>
        <span className="text-sm text-muted-foreground">Moves:</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {set.moves.map((move, i) => (
            <Badge key={i} variant="secondary">
              {Array.isArray(move) ? move.join(" / ") : move}
            </Badge>
          ))}
        </div>
      </div>
      {evEntries.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">EVs: </span>
          <span>{evEntries.map(([stat, val]) => `${val} ${stat.toUpperCase()}`).join(" / ")}</span>
        </div>
      )}
      {ivEntries.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">IVs: </span>
          <span>{ivEntries.map(([stat, val]) => `${val} ${stat.toUpperCase()}`).join(" / ")}</span>
        </div>
      )}
    </div>
  )
}

export function CompetitiveData({ usageByFormat, setsByFormat }: CompetitiveDataProps) {
  const formatsWithUsage = usageByFormat.filter((f) => f.stats !== null)
  const formatsWithSets = setsByFormat.filter((f) => f.sets.length > 0)

  if (formatsWithUsage.length === 0 && formatsWithSets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No competitive data available for this Pokemon.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* Usage Stats */}
      {formatsWithUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formatsWithUsage.map((f) => (
                  <TableRow key={f.formatId}>
                    <TableCell className="font-medium">{f.formatName}</TableCell>
                    <TableCell className="text-right">
                      {formatPercent(f.stats!.usagePercent)}
                    </TableCell>
                    <TableCell className="text-right">#{f.stats!.rank}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Smogon Sets */}
      {formatsWithSets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Sets</CardTitle>
          </CardHeader>
          <CardContent>
            {formatsWithSets.length === 1 ? (
              <div className="space-y-3">
                {formatsWithSets[0].sets.map((set) => (
                  <SetCard key={set.setName} set={set} />
                ))}
              </div>
            ) : (
              <Tabs defaultValue={formatsWithSets[0].formatId}>
                <TabsList>
                  {formatsWithSets.map((f) => (
                    <TabsTrigger key={f.formatId} value={f.formatId}>
                      {f.formatName}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {formatsWithSets.map((f) => (
                  <TabsContent key={f.formatId} value={f.formatId}>
                    <div className="space-y-3 pt-3">
                      {f.sets.map((set) => (
                        <SetCard key={set.setName} set={set} />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
