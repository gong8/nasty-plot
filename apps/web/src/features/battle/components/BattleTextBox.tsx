"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@nasty-plot/ui"

const MIN_CHAR_DELAY_MS = 3
const BASE_CHAR_DELAY_MS = 8

interface BattleTextBoxProps {
  message: string | null
  speed?: number
  className?: string
}

export function BattleTextBox({ message, speed = 1, className }: BattleTextBoxProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const clearTypingInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    clearTypingInterval()

    if (!message) {
      setDisplayedText("")
      setIsTyping(false)
      return
    }

    setDisplayedText("")
    setIsTyping(true)
    let charIndex = 0

    const charDelay = Math.max(MIN_CHAR_DELAY_MS, BASE_CHAR_DELAY_MS / speed)
    intervalRef.current = setInterval(() => {
      charIndex++
      if (charIndex >= message.length) {
        setDisplayedText(message)
        setIsTyping(false)
        clearTypingInterval()
      } else {
        setDisplayedText(message.slice(0, charIndex))
      }
    }, charDelay)

    return clearTypingInterval
  }, [message, speed])

  if (!message) return null

  return (
    <div
      className={cn(
        "absolute bottom-0 inset-x-0 z-30",
        "bg-black/75 backdrop-blur-sm border-t border-white/20 rounded-b-xl",
        "px-4 py-2 min-h-[44px] flex items-center",
        className,
      )}
    >
      <p className="font-mono text-sm text-white leading-relaxed">
        {displayedText}
        {isTyping && <span className="animate-pulse ml-0.5">|</span>}
      </p>
    </div>
  )
}
