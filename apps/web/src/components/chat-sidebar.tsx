"use client";

import { useState } from "react";
import { useChatSidebar } from "@/features/chat/context/chat-provider";
import { ChatSidebarResizeHandle } from "./chat-sidebar-resize-handle";
import { ChatPanel } from "@/features/chat/components/chat-panel";
import { ChatSessionList } from "@/features/chat/components/chat-session-list";
import { X, History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatSidebarProps {
  fullPage?: boolean;
}

export function ChatSidebar({ fullPage = false }: ChatSidebarProps) {
  const { isOpen, width, closeSidebar, activeSessionId } = useChatSidebar();
  const [showHistory, setShowHistory] = useState(false);

  // Full-page mode: static layout with session list on the left
  if (fullPage) {
    return (
      <div className="flex flex-1 min-h-0">
        <ChatSessionList mode="fullpage" />
        <div className="flex-1 min-w-0 flex flex-col">
          <ChatPanel sessionId={activeSessionId ?? undefined} mode="fullpage" />
        </div>
      </div>
    );
  }

  // Sidebar mode: fixed position, right side
  if (!isOpen) return null;

  return (
    <div
      className="fixed top-16 right-0 bottom-0 z-40 flex flex-col border-l border-border bg-background dark:bg-card/95 dark:backdrop-blur-xl"
      style={{ width }}
    >
      <ChatSidebarResizeHandle />

      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowHistory((prev) => !prev)}
            title="Chat history"
          >
            <History className="h-4 w-4" />
          </Button>
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
            alt="Pecharunt"
            width={20}
            height={20}
            className="pixelated"
          />
          <span className="text-sm font-semibold">Pecharunt</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeSidebar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Session list (collapsible in sidebar mode) */}
      {showHistory && (
        <div className="border-b border-border max-h-[40%] overflow-hidden flex flex-col">
          <ChatSessionList mode="sidebar" />
        </div>
      )}

      {/* Chat panel */}
      <div className="flex-1 min-h-0">
        <ChatPanel sessionId={activeSessionId ?? undefined} mode="sidebar" />
      </div>
    </div>
  );
}
