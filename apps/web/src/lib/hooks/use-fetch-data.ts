"use client"

import { useState, useEffect } from "react"
import { fetchJson } from "@/lib/api-client"

export function useFetchData<T>(
  url: string | null,
  enabled = true,
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url || !enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchJson<T>(url)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url, enabled])

  return { data, loading, error }
}
