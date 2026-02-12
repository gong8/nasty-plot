"use client"

import { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NATURE_DATA, STAT_LABELS, NATURES, type NatureName } from "@nasty-plot/core"
import type { PopularityData } from "../../hooks/use-popularity-data"

interface NatureSelectorProps {
  value: NatureName
  onChange: (nature: NatureName) => void
  popularity?: PopularityData
  triggerClassName?: string
}

export function useNaturesByPopularity(popularity?: PopularityData) {
  return useMemo(() => {
    if (!popularity?.natures?.length) {
      return { commonNatures: [] as string[], otherNatures: NATURES as readonly NatureName[] }
    }
    const commonSet = new Set(popularity.natures.map((n) => n.name))
    const common = popularity.natures.map((n) => n.name)
    const other = NATURES.filter((n) => !commonSet.has(n))
    return { commonNatures: common, otherNatures: other }
  }, [popularity])
}

function formatNatureLabel(name: string): string {
  const nd = NATURE_DATA[name as NatureName]
  if (!nd) return `${name} (Neutral)`
  return nd.plus
    ? `${name} (+${STAT_LABELS[nd.plus]}/-${STAT_LABELS[nd.minus!]})`
    : `${name} (Neutral)`
}

export function NatureSelector({
  value,
  onChange,
  popularity,
  triggerClassName,
}: NatureSelectorProps) {
  const { commonNatures, otherNatures } = useNaturesByPopularity(popularity)

  return (
    <Select value={value} onValueChange={(v) => onChange(v as NatureName)}>
      <SelectTrigger className={triggerClassName ?? "w-full"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {commonNatures.length > 0 ? (
          <>
            <SelectGroup>
              <SelectLabel>Common</SelectLabel>
              {commonNatures.map((n) => (
                <SelectItem key={n} value={n}>
                  {formatNatureLabel(n)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>All Natures</SelectLabel>
              {otherNatures.map((n) => (
                <SelectItem key={n} value={n}>
                  {formatNatureLabel(n)}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : (
          NATURES.map((n) => (
            <SelectItem key={n} value={n}>
              {formatNatureLabel(n)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
