"use client";

import { DamageCalculator } from "@/features/damage-calc/components/damage-calculator";
import { SiteHeader } from "@/components/site-header";

export default function DamageCalcPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold font-display mb-2">Damage Calculator</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Know your damage rolls before you click the button. Pecharunt demands precision.
        </p>
        <DamageCalculator />
      </main>
    </div>
  );
}
