"use client"

import { useEffect, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@nasty-plot/ui"
import type { TeamSlotData, PokemonSpecies } from "@nasty-plot/core"
import { SimplifiedSetEditor } from "./simplified-set-editor"

interface StepCustomizeSetsProps {
  slots: Partial<TeamSlotData>[]
  formatId: string
  onUpdate: (position: number, updates: Partial<TeamSlotData>) => void
  onApplyAllSets: () => Promise<void>
}

export function StepCustomizeSets({
  slots,
  formatId,
  onUpdate,
  onApplyAllSets,
}: StepCustomizeSetsProps) {
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null)
  const [appliedSets, setAppliedSets] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Auto-apply sets on first render
  useEffect(() => {
    if (!appliedSets && slots.length > 0) {
      setIsApplying(true)
      onApplyAllSets().finally(() => {
        setIsApplying(false)
        setAppliedSets(true)
        // Expand the first slot by default
        if (slots[0]?.position) {
          setExpandedSlot(slots[0].position)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filledSlots = slots.filter((s) => s.pokemonId)

  // Batch-fetch species data for display names (shares cache with SimplifiedSetEditor)
  const speciesQueries = useQueries({
    queries: filledSlots.map((slot) => ({
      queryKey: ["pokemon", slot.pokemonId!],
      queryFn: async () => {
        const res = await fetch(`/api/pokemon/${slot.pokemonId}`)
        if (!res.ok) throw new Error("Not found")
        const json = await res.json()
        return json.data as PokemonSpecies
      },
      enabled: !!slot.pokemonId,
      staleTime: Infinity,
    })),
  })

  const speciesMap = new Map<string, string>()
  for (const q of speciesQueries) {
    if (q.data) speciesMap.set(q.data.id, q.data.name)
  }

  function speciesName(id: string): string {
    return speciesMap.get(id) ?? id
  }

  const toggleSlot = (position: number) => {
    setExpandedSlot((prev) => (prev === position ? null : position))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold font-display flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Customize Sets
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Smogon&apos;s most popular sets have been applied as a starting point. Tweak abilities,
          items, moves, and natures to fit your playstyle.
        </p>
      </div>

      {/* Loading state while applying sets */}
      {isApplying && (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading recommended sets...</span>
        </div>
      )}

      {/* Slot accordions */}
      {!isApplying && (
        <div className="space-y-2">
          {filledSlots.map((slot) => {
            const position = slot.position!
            const isExpanded = expandedSlot === position
            const hasSet = !!slot.ability
            const name = speciesName(slot.pokemonId!)

            return (
              <Card key={position} className="overflow-hidden">
                {/* Accordion header */}
                <button
                  onClick={() => toggleSlot(position)}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3 text-left transition-colors",
                    "hover:bg-accent/50",
                    isExpanded && "border-b",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {position}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{name}</span>
                      {hasSet && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {slot.ability} / {slot.item || "No item"} / {slot.nature}
                        </span>
                      )}
                      {!hasSet && (
                        <span className="text-xs text-muted-foreground ml-2">No set applied</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* Accordion content */}
                {isExpanded && (
                  <CardContent className="pt-4">
                    <SimplifiedSetEditor
                      slot={slot}
                      formatId={formatId}
                      setInfo={
                        hasSet ? `This is the most popular ${name} set in ${formatId}.` : undefined
                      }
                      onUpdate={(updates) => onUpdate(position, updates)}
                    />
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {filledSlots.length === 0 && !isApplying && (
        <div className="text-center py-8 text-muted-foreground">
          No Pokemon selected. Go back to pick your team.
        </div>
      )}
    </div>
  )
}
