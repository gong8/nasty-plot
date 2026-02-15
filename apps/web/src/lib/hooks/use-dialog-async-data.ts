"use client"

import { useState, useEffect } from "react"

export function useDialogAsyncData<T>(
  open: boolean,
  fetchFn: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)

    fetchFn()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => console.error("[use-dialog-async-data]:", err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...deps])

  return { data, loading }
}
