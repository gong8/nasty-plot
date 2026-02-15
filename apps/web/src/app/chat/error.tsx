"use client"

import { ErrorPage } from "@/components/ErrorPage"

export default function ChatError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPage
      title="Chat unavailable"
      error={error}
      fallbackMessage="The team assistant encountered an error. Please try again."
      reset={reset}
    />
  )
}
