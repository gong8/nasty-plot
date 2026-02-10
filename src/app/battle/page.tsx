"use client";

import Link from "next/link";
import { SiteHeader } from "@/shared/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swords, Zap, Brain, Dices } from "lucide-react";

export default function BattleHubPage() {
  return (
    <>
      <SiteHeader />
      <main className="container mx-auto p-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Battle Simulator</h1>
          <p className="text-muted-foreground">
            Test your teams against AI opponents
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <Link href="/battle/new">
            <Button size="lg" className="gap-2">
              <Swords className="h-5 w-5" />
              Start New Battle
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Dices className="h-4 w-4" />
                Random AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Picks random legal moves. Good for casual practice and testing new teams.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Greedy AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Picks the highest damage move each turn. Tests your defensive play.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Smart AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Type-aware switching, status moves, and setup. A real challenge.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
