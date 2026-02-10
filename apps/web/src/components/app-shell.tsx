"use client"

import { useEffect, useRef, useState } from "react"
import { SiteHeader } from "./site-header"
import { ChatSidebar } from "./chat-sidebar"
import { ChatFab } from "./chat-fab"
import { useChatSidebar } from "@/features/chat/context/chat-provider"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isOpen, width, toggleSidebar } = useChatSidebar()
  const prevIsOpen = useRef(isOpen)
  const [animating, setAnimating] = useState(false)

  // Cmd/Ctrl+L keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // Only enable the margin-right transition when isOpen actually toggles,
  // not on theme changes / hydration / width resizes.
  useEffect(() => {
    if (isOpen !== prevIsOpen.current) {
      prevIsOpen.current = isOpen
      setAnimating(true)
      const timer = setTimeout(() => setAnimating(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // NOTE: Full-page chat mode (isChatPage -> <ChatSidebar fullPage />) is
  // intentionally disabled. The code in ChatSidebar still supports fullPage
  // prop if we want to re-enable it later.

  const mainMarginRight = isOpen ? width : 0

  return (
    <div className="min-h-screen flex flex-col">
      <div
        className={animating ? "transition-[margin-right] duration-200 ease-in-out" : ""}
        style={{ marginRight: mainMarginRight }}
      >
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </div>
      <ChatSidebar />
      <ChatFab />
    </div>
  )
}
