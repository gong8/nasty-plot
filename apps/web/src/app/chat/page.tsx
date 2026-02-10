"use client"

import { useEffect } from "react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"

// The /chat route opens the sidebar automatically.
// Full-page chat mode is preserved in ChatSidebar (fullPage prop) but disabled.
export default function ChatPage() {
  const { openSidebar } = useChatSidebar()

  useEffect(() => {
    openSidebar()
  }, [openSidebar])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
        alt="Pecharunt"
        width={96}
        height={96}
        className="pixelated mb-4"
      />
      <h1 className="text-2xl font-bold">Pecharunt&apos;s Team Lab</h1>
      <p className="text-muted-foreground mt-2 text-center max-w-md">
        Your competitive Pokemon assistant. Ask about team building, sets, damage calcs, meta
        trends, and team synergy.
      </p>
      <p className="text-sm text-muted-foreground mt-4">
        The chat sidebar should be open on the right &rarr;
      </p>
    </div>
  )
}
