"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useChatSidebar } from "@/features/chat/context/chat-provider";
import { useChatStream } from "@/features/chat/hooks/use-chat-stream";
import { ChatMessage } from "./chat-message";
import { ChatToolCall } from "./chat-tool-call";
import { ChatActionNotify } from "./chat-action-notify";
import { ChatPlanDisplay } from "./chat-plan-display";
import { ChatInput } from "./chat-input";
import { ArrowDown } from "lucide-react";

interface ChatPanelProps {
  teamId?: string;
  formatId?: string;
  sessionId?: string;
  mode?: "sidebar" | "fullpage";
}

export function ChatPanel({ sessionId, mode = "sidebar" }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { activeSessionId, pendingInput, clearPendingInput } = useChatSidebar();
  const effectiveSessionId = sessionId ?? activeSessionId ?? undefined;
  const [isAtBottom, setIsAtBottom] = useState(true);

  const {
    messages,
    isStreaming,
    toolCalls,
    actionNotifications,
    planSteps,
    sendMessage,
    stopGeneration,
    retryLast,
    resetForSession,
  } = useChatStream(effectiveSessionId);

  // Load session on mount and when active session changes.
  // Initialize to null (not effectiveSessionId) so the first render
  // triggers a load when there's already an active session from localStorage.
  const prevSessionRef = useRef<string | undefined | null>(null);
  useEffect(() => {
    if (effectiveSessionId !== prevSessionRef.current) {
      prevSessionRef.current = effectiveSessionId;
      resetForSession(effectiveSessionId ?? null);
      setIsAtBottom(true);
    }
  }, [effectiveSessionId, resetForSession]);

  // Track scroll position to detect if user has scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 60;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setIsAtBottom(atBottom);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only when user is at the bottom
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, toolCalls, planSteps, isAtBottom]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  }, []);

  const handleSend = useCallback(
    (text: string) => sendMessage(text),
    [sendMessage]
  );

  const lastMsg = messages[messages.length - 1];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages — native scrollable div */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <img
                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
                alt="Pecharunt"
                width={64}
                height={64}
                className="pixelated mx-auto mb-3"
              />
              <p className="text-lg font-medium text-foreground">
                Pecharunt&apos;s Team Lab
              </p>
              <p className="text-sm mt-1 text-muted-foreground">
                Ask about competitive sets, damage calcs, meta trends, and team synergy.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={isStreaming && msg === lastMsg}
            />
          ))}

          {/* Plan display */}
          <ChatPlanDisplay steps={planSteps} />

          {/* Tool calls */}
          {Array.from(toolCalls.values()).map((tc) => (
            <ChatToolCall key={tc.name} toolCall={tc} />
          ))}

          {/* Action notifications */}
          {actionNotifications.map((notif, i) => (
            <ChatActionNotify key={`${notif.name}-${i}`} notification={notif} />
          ))}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-8 w-8 rounded-full border border-border bg-background shadow-md hover:bg-accent transition-colors"
            title="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        onStop={stopGeneration}
        onRetry={retryLast}
        isStreaming={isStreaming}
        hasMessages={messages.length > 0}
        lastMessageIsAssistant={lastMsg?.role === "assistant"}
        pendingInput={pendingInput}
        onClearPendingInput={clearPendingInput}
      />
    </div>
  );
}
