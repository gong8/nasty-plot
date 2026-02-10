"use client";

import { useEffect } from "react";
import { SiteHeader } from "./site-header";
import { ChatSidebar } from "./chat-sidebar";
import { ChatFab } from "./chat-fab";
import { useChatSidebar } from "@/features/chat/context/chat-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isOpen, width, toggleSidebar } = useChatSidebar();

  // Cmd/Ctrl+L keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // NOTE: Full-page chat mode (isChatPage -> <ChatSidebar fullPage />) is
  // intentionally disabled. The code in ChatSidebar still supports fullPage
  // prop if we want to re-enable it later.

  const mainMarginRight = isOpen ? width : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 transition-[margin-right] duration-200 ease-in-out"
        style={{ marginRight: mainMarginRight }}
      >
        {children}
      </main>
      <ChatSidebar />
      <ChatFab />
    </div>
  );
}
