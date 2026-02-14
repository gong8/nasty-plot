"use client"

import { useCallback, useMemo } from "react"
import { NATURE_DATA, STAT_LABELS, NATURES, type NatureName } from "@nasty-plot/core"
import { GroupedSelector } from "@nasty-plot/ui"
import type { PopularityData } from "../../hooks/use-popularity-data"
import { usePopularityGroups } from "@/hooks/use-popularity-groups"

interface NatureSelectorProps {
  value: NatureName
  onChange: (nature: NatureName) => void
  popularity?: PopularityData
  triggerClassName?: string
}

export function useNaturesByPopularity(popularity?: PopularityData) {
  const popularNatures = useMemo(
    () => popularity?.natures?.map((n) => ({ name: n.name, usagePercent: n.count })),
    [popularity],
  )
  const getNatureKey = useCallback((n: NatureName) => n, [])
  const { common, other } = usePopularityGroups(
    NATURES as unknown as NatureName[],
    popularNatures,
    getNatureKey,
  )
  return { commonNatures: common, otherNatures: other }
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

  const groups = useMemo(() => {
    if (commonNatures.length > 0) {
      return [
        {
          label: "Common",
          items: commonNatures.map((n) => ({ value: n, label: formatNatureLabel(n) })),
        },
        {
          label: "All Natures",
          items: otherNatures.map((n) => ({ value: n, label: formatNatureLabel(n) })),
        },
      ]
    }
    return [
      {
        label: "All Natures",
        items: NATURES.map((n) => ({ value: n, label: formatNatureLabel(n) })),
      },
    ]
  }, [commonNatures, otherNatures])

  return (
    <GroupedSelector
      value={value}
      onValueChange={(v) => onChange(v as NatureName)}
      groups={groups}
      triggerClassName={triggerClassName ?? "w-full"}
    />
  )
}
