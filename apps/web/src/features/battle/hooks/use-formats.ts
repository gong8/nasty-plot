"use client"

import { useQuery } from "@tanstack/react-query"
import type { FormatDefinition } from "@nasty-plot/core"
import { fetchJson } from "@/lib/api-client"

async function fetchFormats(): Promise<FormatDefinition[]> {
  const json = await fetchJson<{ data?: FormatDefinition[] } | FormatDefinition[]>("/api/formats")
  const formats = Array.isArray(json) ? json : (json.data ?? [])
  if (!Array.isArray(formats)) {
    throw new Error(`Invalid formats response: expected array, got ${typeof formats}`)
  }
  return formats
}

export function useFormats(activeOnly?: boolean) {
  const query = useQuery<FormatDefinition[]>({
    queryKey: ["formats"],
    queryFn: fetchFormats,
    staleTime: 5 * 60 * 1000,
  })

  const formats = query.data ?? []
  const filtered = activeOnly ? formats.filter((f) => f.isActive) : formats

  return { isLoading: query.isLoading, error: query.error, data: filtered }
}

export function useFormat(formatId: string) {
  const { data: formats } = useFormats()
  return formats.find((f) => f.id === formatId)
}
