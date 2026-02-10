"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, User } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ToolCallStatus {
  name: string;
  status: "executing" | "complete";
}

interface ChatPanelProps {
  teamId?: string;
  formatId?: string;
  sessionId?: string;
}

const TOOL_LABELS: Record<string, string> = {
  search_pokemon: "Searching Pokemon...",
  get_usage_stats: "Fetching usage stats...",
  calculate_damage: "Calculating damage...",
  analyze_team: "Analyzing team...",
  suggest_teammates: "Finding teammates...",
};

export function ChatPanel({ teamId, formatId, sessionId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing session messages
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/chat/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data?.messages) {
          setMessages(
            data.data.messages
              .filter((m: { role: string }) => m.role !== "system")
              .map((m: { id?: number; role: string; content: string }, i: number) => ({
                id: m.id?.toString() ?? `loaded-${i}`,
                role: m.role as "user" | "assistant",
                content: m.content,
              }))
          );
        }
      })
      .catch(console.error);
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeToolCall]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setActiveToolCall(null);

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: trimmed,
          teamId,
          formatId,
        }),
      });

      // Capture session ID from response
      const newSessionId = res.headers.get("X-Session-Id");
      if (newSessionId && !currentSessionId) {
        setCurrentSessionId(newSessionId);
      }

      if (!res.ok || !res.body) {
        throw new Error("Failed to get response");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.content,
                  };
                }
                return updated;
              });
            }

            if (parsed.toolCall) {
              const tc = parsed.toolCall as ToolCallStatus;
              if (tc.status === "executing") {
                setActiveToolCall(tc.name);
              } else {
                setActiveToolCall(null);
              }
            }

            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: `Error: ${parsed.error}`,
                  };
                }
                return updated;
              });
            }
          } catch {
            // Skip non-JSON
          }
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content:
              "Sorry, I encountered an error. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      setActiveToolCall(null);
    }
  }, [input, isStreaming, currentSessionId, teamId, formatId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex flex-col flex-1 p-0 gap-0">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef as React.RefObject<HTMLDivElement>}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
                  alt="Pecharunt"
                  width={64}
                  height={64}
                  className="pixelated mx-auto mb-3"
                />
                <p className="text-lg font-medium">
                  Pecharunt&apos;s Team Lab
                </p>
                <p className="text-sm mt-1">
                  Ask about competitive sets, damage calcs, meta trends, and team synergy.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user"
                    ? "flex-row-reverse"
                    : "flex-row"
                }`}
              >
                <div
                  className={`flex-shrink-0 rounded-full flex items-center justify-center ${
                    msg.role === "user"
                      ? "w-8 h-8 bg-primary text-primary-foreground"
                      : "w-9 h-9 bg-accent/15 text-accent"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <img
                      src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
                      alt="Pecharunt"
                      width={24}
                      height={24}
                      className="pixelated"
                    />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 dark:bg-primary/5 border border-border"
                  }`}
                >
                  {msg.content ||
                    (msg.role === "assistant" && isStreaming && (
                      <span className="opacity-50">Pecharunt is scheming...</span>
                    ))}
                </div>
              </div>
            ))}

            {/* Tool call indicator */}
            {activeToolCall && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>
                  {TOOL_LABELS[activeToolCall] ??
                    `Running ${activeToolCall}...`}
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about team building, sets, damage calcs..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="flex-shrink-0 h-[44px] w-[44px]"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
