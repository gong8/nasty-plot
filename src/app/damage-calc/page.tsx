"use client";

import { DamageCalculator } from "@/modules/damage-calc/components/damage-calculator";
import { SiteHeader } from "@/shared/components/site-header";

export default function DamageCalcPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">Damage Calculator</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Calculate damage output between Pokemon. Enter species names (e.g. &quot;Great Tusk&quot;, &quot;Iron Valiant&quot;),
          configure sets, and select a move to see damage ranges and KO chances.
        </p>
        <DamageCalculator />
      </main>
    </div>
  );
}
