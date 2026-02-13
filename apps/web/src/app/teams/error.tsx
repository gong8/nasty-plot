"use client"

import { ErrorPage } from "@/components/error-page"

export default function TeamsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPage
      title="Failed to load teams"
      error={error}
      fallbackMessage="Could not load your teams. Please try again."
      reset={reset}
    />
  )
}
