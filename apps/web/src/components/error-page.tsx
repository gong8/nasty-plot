"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorPageProps {
  title: string
  error: Error
  fallbackMessage: string
  reset: () => void
  sprite?: { src: string; alt: string }
}

export function ErrorPage({ title, error, fallbackMessage, reset, sprite }: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          {sprite && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={sprite.src}
              alt={sprite.alt}
              width={64}
              height={64}
              className="pixelated mx-auto"
            />
          )}
          <CardTitle className="font-display">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error.message || fallbackMessage}</p>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  )
}
