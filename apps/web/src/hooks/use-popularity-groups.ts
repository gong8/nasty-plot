"use client"

import { useMemo } from "react"

export function usePopularityGroups<T>(
  items: T[],
  popularItems: Array<{ name: string; usagePercent: number }> | undefined,
  getKey: (item: T) => string,
): { common: T[]; other: T[] } {
  return useMemo(() => {
    if (!popularItems || popularItems.length === 0) {
      return { common: [], other: items }
    }
    const popularSet = new Set(popularItems.map((p) => p.name))
    const common: T[] = []
    const other: T[] = []
    for (const item of items) {
      if (popularSet.has(getKey(item))) {
        common.push(item)
      } else {
        other.push(item)
      }
    }
    return { common, other }
  }, [items, popularItems, getKey])
}
