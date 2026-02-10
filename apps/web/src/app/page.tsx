import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-4xl font-bold tracking-tight">
            Build Competitive Pokemon Teams
          </h2>
          <p className="text-lg text-muted-foreground">
            Scarlet/Violet team builder with usage data, damage calculator,
            matchup analysis, and AI-powered recommendations. Supports VGC,
            Smogon tiers, and Battle Stadium.
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
                Build teams for any competitive format with format-aware
                legality checks and tier-specific usage data.
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
                Calculate damage rolls, view matchup matrices against meta
                threats, and find coverage gaps.
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
                Get teammate recommendations based on usage data, type coverage,
                and synergy scoring with explanations.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
