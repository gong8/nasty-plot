"use client"

import { ErrorPage } from "@/components/ErrorPage"

export default function PokemonError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPage
      title="Failed to load Pokemon"
      error={error}
      fallbackMessage="Could not load the Pokemon browser. Please try again."
      reset={reset}
    />
  )
}
