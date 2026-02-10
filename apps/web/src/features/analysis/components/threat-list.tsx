"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Shield, Info } from "lucide-react";
import type { ThreatEntry } from "@nasty-plot/core";
import { cn } from "@/lib/utils";

interface ThreatListProps {
  threats: ThreatEntry[] | undefined;
  isLoading?: boolean;
}

function getThreatBadge(level: ThreatEntry["threatLevel"]) {
  switch (level) {
    case "high":
      return { variant: "destructive" as const, icon: AlertTriangle, label: "High" };
    case "medium":
      return { variant: "secondary" as const, icon: Shield, label: "Med" };
    case "low":
      return { variant: "outline" as const, icon: Info, label: "Low" };
  }
}

export function ThreatList({ threats, isLoading }: ThreatListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Threats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!threats || threats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Threats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No significant threats identified. This could mean usage data is not available for this format.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Threats ({threats.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {threats.map((threat) => {
            const badge = getThreatBadge(threat.threatLevel);
            const Icon = badge.icon;

            return (
              <div
                key={threat.pokemonId}
                className={cn(
                  "flex items-start gap-3 p-2.5 rounded-lg border transition-colors",
                  threat.threatLevel === "high" && "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20",
                  threat.threatLevel === "medium" && "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-950/20",
                  threat.threatLevel === "low" && "border-border"
                )}
              >
                {/* Pokemon Avatar */}
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                  {threat.pokemonName.slice(0, 2)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {threat.pokemonName}
                    </span>
                    <Badge variant={badge.variant} className="text-[10px] h-5 px-1.5 shrink-0">
                      <Icon className="h-3 w-3 mr-0.5" />
                      {badge.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {threat.usagePercent.toFixed(1)}% usage
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {threat.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
