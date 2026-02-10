"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swords, Zap, Brain, Dices } from "lucide-react";

export default function BattleHubPage() {
  return (
    <>
      <SiteHeader />
      <main className="container mx-auto p-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display mb-2">Battle Simulator</h1>
          <p className="text-muted-foreground">
            Stress-test your team against AI opponents. Pecharunt watches with glee.
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
                Picks moves at random. A punching bag for testing new teams.
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
                Always goes for maximum damage. Punishes weak defensive cores.
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
                Type-aware switching, status moves, and setup plays. The closest thing to a real opponent.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
