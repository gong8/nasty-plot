"use client";

import { useState } from "react";
import { Loader2, Check, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/features/chat/hooks/use-chat-stream";

interface ChatToolCallProps {
  toolCall: ToolCallState;
}

export function ChatToolCall({ toolCall }: ChatToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    executing: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
    complete: <Check className="h-3.5 w-3.5 text-green-500" />,
    error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  }[toolCall.status];

  const hasInput = Object.keys(toolCall.input).length > 0;

  return (
    <div className="ml-12 my-1">
      <button
        onClick={() => hasInput && setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 rounded-md transition-colors w-full text-left",
          hasInput && "hover:bg-muted/50 cursor-pointer",
          !hasInput && "cursor-default"
        )}
      >
        {statusIcon}
        <span className="flex-1 truncate">{toolCall.label}</span>
        {hasInput && (
          expanded
            ? <ChevronDown className="h-3 w-3 shrink-0" />
            : <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>
      {expanded && hasInput && (
        <div className="ml-6 mt-1 p-2 rounded bg-muted/30 text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre-wrap text-muted-foreground">
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
