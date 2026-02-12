"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PECHARUNT_SPRITE_URL}
            alt="Pecharunt"
            width={64}
            height={64}
            className="pixelated mx-auto"
          />
          <CardTitle className="font-display">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || "Pecharunt's mischief caused an unexpected error."}
          </p>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  )
}
