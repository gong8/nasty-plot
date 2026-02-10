import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
            alt="Pecharunt"
            width={96}
            height={96}
            className="pixelated mx-auto"
          />
          <h2 className="text-4xl font-bold tracking-tight font-display">
            Build Competitive Pokemon Teams
          </h2>
          <p className="text-lg text-muted-foreground">
            Your war room for Scarlet/Violet. Usage data, damage rolls, matchup analysis, and AI-powered teambuilding.
          </p>
          <p className="text-sm text-muted-foreground italic">
            Every great team starts with a nasty plot. Pecharunt approves.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/teams/new">
              <Button size="lg">Build a Team</Button>
            </Link>
            <Link href="/pokemon">
              <Button size="lg" variant="outline">Browse Pokemon</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Format Support</CardTitle>
              <CardDescription>VGC, Smogon, Battle Stadium</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Build for any competitive format with legality checks
                and tier-specific usage data baked in.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Damage Calculator</CardTitle>
              <CardDescription>Full matchup matrix</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run damage rolls, view matchup matrices against meta
                threats, and spot coverage gaps before they cost you a game.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Suggestions</CardTitle>
              <CardDescription>Usage + coverage analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Teammate recommendations driven by usage data, type coverage,
                and synergy scoring — with reasoning you can learn from.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
