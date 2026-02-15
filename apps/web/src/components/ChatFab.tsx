"use client"

import { usePathname } from "next/navigation"
import { useChatSidebar } from "@/features/chat/context/ChatProvider"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

export function ChatFab() {
  const pathname = usePathname()
  const { toggleSidebar, isOpen } = useChatSidebar()

  // Hide on /chat page (full-page mode) and when sidebar is open
  if (pathname === "/chat" || isOpen) return null

  return (
    <button
      onClick={toggleSidebar}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      aria-label="Open Pecharunt chat"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PECHARUNT_SPRITE_URL}
        alt="Pecharunt"
        width={32}
        height={32}
        className="pixelated"
      />
    </button>
  )
}
