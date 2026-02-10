"use client"

import { useCallback, useRef } from "react"
import { useChatSidebar, MIN_WIDTH, MAX_WIDTH } from "@/features/chat/context/chat-provider"

export function ChatSidebarResizeHandle() {
  const { width, setWidth } = useChatSidebar()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = width

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragging.current) return
        // Dragging left increases width (sidebar is on right)
        const delta = startX.current - ev.clientX
        const maxVw = typeof window !== "undefined" ? window.innerWidth * 0.5 : MAX_WIDTH
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(Math.min(MAX_WIDTH, maxVw), startWidth.current + delta),
        )
        requestAnimationFrame(() => setWidth(newWidth))
      }

      const onPointerUp = () => {
        dragging.current = false
        document.removeEventListener("pointermove", onPointerMove)
        document.removeEventListener("pointerup", onPointerUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.addEventListener("pointermove", onPointerMove)
      document.addEventListener("pointerup", onPointerUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [width, setWidth],
  )

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
    />
  )
}
