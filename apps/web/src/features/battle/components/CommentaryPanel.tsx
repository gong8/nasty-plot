"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BattleState, BattleLogEntry } from "@nasty-plot/battle-engine";

interface CommentaryPanelProps {
  state: BattleState;
  recentEntries: BattleLogEntry[];
  team1Name?: string;
  team2Name?: string;
  className?: string;
}

export function CommentaryPanel({
  state,
  recentEntries,
  team1Name = "Player",
  team2Name = "Opponent",
  className,
}: CommentaryPanelProps) {
  const [comments, setComments] = useState<{ turn: number; text: string }[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchCommentary = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setCurrentText("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/battles/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "turn",
          state,
          recentEntries,
          team1Name,
          team2Name,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed to fetch commentary");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                text += parsed.content;
                setCurrentText(text);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      if (text) {
        setComments((prev) => [...prev, { turn: state.turn, text }]);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("[Commentary]", err);
      }
    } finally {
      setIsLoading(false);
      setCurrentText("");
    }
  }, [state, recentEntries, team1Name, team2Name, isLoading]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <Card className={className}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          Commentary
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchCommentary}
          disabled={isLoading || recentEntries.length === 0}
          className="h-7 text-xs"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          Analyze Turn
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px] px-4 pb-3">
          {comments.length === 0 && !currentText && (
            <p className="text-xs text-muted-foreground py-2">
              Click &quot;Analyze Turn&quot; for AI commentary on the current
              turn.
            </p>
          )}
          {comments.map((c, i) => (
            <div key={i} className="mb-3">
              <span className="text-xs font-medium text-muted-foreground">
                Turn {c.turn}
              </span>
              <p className="text-sm mt-0.5">{c.text}</p>
            </div>
          ))}
          {currentText && (
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground">
                Turn {state.turn}
              </span>
              <p className="text-sm mt-0.5">
                {currentText}
                <span className="animate-pulse">&#9610;</span>
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
