"use client"

import Link from "next/link"
import { Swords, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface QuickBattleCardProps {
  teamId: string
  formatId: string
}

export function QuickBattleCard({ teamId, formatId }: QuickBattleCardProps) {
  const href = `/battle/new?teamId=${teamId}&formatId=${formatId}`

  return (
    <Card className="border-primary/20 bg-linear-to-br from-card to-primary/5 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Swords className="w-32 h-32 text-primary" />
      </div>

      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-primary">
          <Sparkles className="w-5 h-5" />
          Test in Battle
        </CardTitle>
        <CardDescription>
          Test this team against an AI opponent in the battle simulator.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Button
          className="w-full h-12 text-lg font-display shadow-lg shadow-primary/20 bg-linear-to-r from-primary to-purple-600 hover:to-purple-500 transition-all hover:scale-[1.01]"
          asChild
        >
          <Link href={href}>
            <Swords className="w-5 h-5 mr-2" /> Set Up Battle
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
