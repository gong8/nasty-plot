"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatSidebar } from "@/features/chat/context/chat-provider";
import type { GuidedStep } from "../../hooks/use-guided-builder";

const SUGGESTED_QUESTIONS: Record<GuidedStep, string[]> = {
  start: [
    "What format should I play?",
    "Help me choose a team style",
  ],
  lead: [
    "Why is this Pokemon a good lead?",
    "What team archetype should I build?",
  ],
  build: [
    "What should my next pick be?",
    "What are my team's weaknesses?",
    "Why this recommendation?",
  ],
  sets: [
    "Is this the best set?",
    "What nature should I run?",
    "Why this item?",
  ],
  review: [
    "Is this team competitive?",
    "What are my biggest threats?",
    "How should I play this team?",
  ],
};

interface AskPecharuntButtonProps {
  step: GuidedStep;
  className?: string;
}

export function AskPecharuntButton({ step, className }: AskPecharuntButtonProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { openSidebar } = useChatSidebar();

  const questions = SUGGESTED_QUESTIONS[step];

  function handleMainClick() {
    openSidebar();
    setShowSuggestions((prev) => !prev);
  }

  function handleQuestionClick(question: string) {
    openSidebar(question);
    setShowSuggestions(false);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleMainClick}
        className="gap-2"
      >
        <img
          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
          alt="Pecharunt"
          width={20}
          height={20}
          className="pixelated"
        />
        <MessageCircle className="size-3.5" />
        Ask Pecharunt
      </Button>

      {showSuggestions && questions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {questions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => handleQuestionClick(question)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
