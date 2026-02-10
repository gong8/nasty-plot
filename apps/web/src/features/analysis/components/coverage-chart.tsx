"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { POKEMON_TYPES, TYPE_COLORS, type PokemonType, type TypeCoverage } from "@nasty-plot/core";
import { cn } from "@/lib/utils";

interface CoverageChartProps {
  coverage: TypeCoverage | undefined;
}

function getCoverageLevel(count: number): {
  label: string;
  className: string;
} {
  if (count === 0) return { label: "None", className: "bg-red-500/20 text-red-700 border-red-300" };
  if (count === 1) return { label: "1x", className: "bg-yellow-500/20 text-yellow-700 border-yellow-300" };
  if (count === 2) return { label: "2x", className: "bg-green-400/20 text-green-700 border-green-300" };
  return { label: `${count}x`, className: "bg-green-600/20 text-green-800 border-green-400" };
}

export function CoverageChart({ coverage }: CoverageChartProps) {
  const [mode, setMode] = useState<"offensive" | "defensive">("offensive");

  if (!coverage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Type Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add Pokemon to your team to see type coverage analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = mode === "offensive" ? coverage.offensive : coverage.defensive;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Type Coverage</CardTitle>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "offensive" | "defensive")}>
            <TabsList className="h-7">
              <TabsTrigger value="offensive" className="text-xs h-6 px-2">Offensive</TabsTrigger>
              <TabsTrigger value="defensive" className="text-xs h-6 px-2">Defensive</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 gap-1.5">
          {POKEMON_TYPES.map((type) => {
            const count = data[type] ?? 0;
            const { label, className } = getCoverageLevel(count);
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "rounded-md p-1.5 text-center border cursor-default transition-all hover:scale-105",
                      className
                    )}
                  >
                    <div
                      className="text-[10px] font-bold truncate"
                      style={{ color: TYPE_COLORS[type] }}
                    >
                      {type}
                    </div>
                    <div className="text-[10px] font-mono">{label}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {mode === "offensive"
                      ? `${count} team member${count !== 1 ? "s" : ""} can hit ${type} super-effectively`
                      : `${count} team member${count !== 1 ? "s" : ""} resist${count === 1 ? "s" : ""} ${type}`}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Warnings */}
        <div className="mt-3 space-y-1.5">
          {coverage.uncoveredTypes.length > 0 && (
            <div className="flex items-start gap-2">
              <Badge variant="destructive" className="text-[10px] shrink-0">Gap</Badge>
              <p className="text-xs text-muted-foreground">
                No SE coverage: {coverage.uncoveredTypes.join(", ")}
              </p>
            </div>
          )}
          {coverage.sharedWeaknesses.length > 0 && (
            <div className="flex items-start gap-2">
              <Badge variant="destructive" className="text-[10px] shrink-0">Weak</Badge>
              <p className="text-xs text-muted-foreground">
                Shared weaknesses: {coverage.sharedWeaknesses.join(", ")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
