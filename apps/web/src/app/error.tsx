"use client"

import { ErrorPage } from "@/components/ErrorPage"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPage
      title="Something went wrong"
      error={error}
      fallbackMessage="Pecharunt's mischief caused an unexpected error."
      reset={reset}
      sprite={{ src: PECHARUNT_SPRITE_URL, alt: "Pecharunt" }}
    />
  )
}
