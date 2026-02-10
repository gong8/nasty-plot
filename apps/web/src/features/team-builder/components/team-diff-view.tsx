"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PokemonSprite } from "@nasty-plot/ui";
import type { TeamDiff, SlotChange, TeamSlotData } from "@nasty-plot/core";

interface TeamDiffViewProps {
  diff: TeamDiff;
}

export function TeamDiffView({ diff }: TeamDiffViewProps) {
  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{diff.teamAName}</h3>
          <span className="text-muted-foreground">vs</span>
          <h3 className="text-lg font-semibold">{diff.teamBName}</h3>
        </div>
        <div className="flex gap-2 text-sm">
          {diff.summary.slotsChanged > 0 && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              {diff.summary.slotsChanged} changed
            </Badge>
          )}
          {diff.summary.slotsAdded > 0 && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              {diff.summary.slotsAdded} added
            </Badge>
          )}
          {diff.summary.slotsRemoved > 0 && (
            <Badge variant="outline" className="border-red-500 text-red-600">
              {diff.summary.slotsRemoved} removed
            </Badge>
          )}
          {diff.summary.slotsUnchanged > 0 && (
            <Badge variant="secondary">
              {diff.summary.slotsUnchanged} unchanged
            </Badge>
          )}
        </div>
      </div>

      {/* Changed Slots */}
      {diff.changed.map((change) => (
        <ChangedSlotRow key={change.pokemonId} change={change} />
      ))}

      {/* Added Slots */}
      {diff.added.map((slot) => (
        <SlotRow
          key={`added-${slot.pokemonId}-${slot.position}`}
          slot={slot}
          type="added"
        />
      ))}

      {/* Removed Slots */}
      {diff.removed.map((slot) => (
        <SlotRow
          key={`removed-${slot.pokemonId}-${slot.position}`}
          slot={slot}
          type="removed"
        />
      ))}

      {/* Unchanged */}
      {diff.unchanged.length > 0 && (
        <Card className="opacity-60">
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-muted-foreground">
              Unchanged ({diff.unchanged.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex gap-2 flex-wrap">
              {diff.unchanged.map((id) => (
                <Badge key={id} variant="secondary">{id}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChangedSlotRow({ change }: { change: SlotChange }) {
  return (
    <Card className="border-yellow-500/30">
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{change.name}</span>
          <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs">
            {change.changes.length} change{change.changes.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="grid gap-1">
          {change.changes.map((fc) => (
            <div key={fc.field} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-28 shrink-0">{fc.label}</span>
              <span className="text-red-500 line-through">{fc.before ?? "none"}</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="text-green-500">{fc.after ?? "none"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SlotRow({
  slot,
  type,
}: {
  slot: TeamSlotData;
  type: "added" | "removed";
}) {
  const isAdded = type === "added";
  return (
    <Card className={isAdded ? "border-green-500/30" : "border-red-500/30"}>
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          {slot.species?.num && (
            <PokemonSprite pokemonId={slot.pokemonId} num={slot.species.num} size={32} />
          )}
          <span className="font-medium">{slot.species?.name ?? slot.pokemonId}</span>
          <Badge
            variant="outline"
            className={
              isAdded
                ? "border-green-500 text-green-600 text-xs"
                : "border-red-500 text-red-600 text-xs"
            }
          >
            {isAdded ? "Added" : "Removed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{slot.ability}</span>
          <span>{slot.item}</span>
          <span>{slot.nature}</span>
          {slot.moves.filter(Boolean).map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
