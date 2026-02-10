"use client";

import { cn } from "@/lib/utils";
import type { MoveHint, MoveClassification } from "@nasty-plot/battle-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface HintPanelProps {
  hints: MoveHint[];
  onSelectHint?: (hint: MoveHint) => void;
  className?: string;
}

const classColors: Record<MoveClassification, string> = {
  best: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  good: "bg-green-500/15 text-green-600 border-green-500/30",
  neutral: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  inaccuracy: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  mistake: "bg-red-500/15 text-red-600 border-red-500/30",
  blunder: "bg-red-700/15 text-red-700 border-red-700/30",
};

const classLabels: Record<MoveClassification, string> = {
  best: "Best",
  good: "Good",
  neutral: "OK",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export function HintPanel({ hints, onSelectHint, className }: HintPanelProps) {
  if (hints.length === 0) return null;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4" />
          Move Hints
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
        {hints.map((hint, i) => (
          <button
            key={i}
            onClick={() => onSelectHint?.(hint)}
            className={cn(
              "w-full text-left rounded-md border px-3 py-2 text-sm transition-colors hover:opacity-80",
              classColors[hint.classification],
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{hint.name}</span>
              <span className="text-xs opacity-75">{classLabels[hint.classification]}</span>
            </div>
            <p className="text-xs mt-0.5 opacity-75">{hint.explanation}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
