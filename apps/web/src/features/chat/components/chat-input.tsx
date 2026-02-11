"use client"

import { useRef, useEffect } from "react"
import { Send, Square, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  onRetry: () => void
  isStreaming: boolean
  hasMessages: boolean
  lastMessageIsAssistant: boolean
  pendingInput?: string | null
  onClearPendingInput?: () => void
  disabled?: boolean
}

export function ChatInput({
  onSend,
  onStop,
  onRetry,
  isStreaming,
  hasMessages,
  lastMessageIsAssistant,
  pendingInput,
  onClearPendingInput,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef("")

  // Pre-fill input when a suggested question is clicked
  useEffect(() => {
    if (pendingInput && textareaRef.current) {
      textareaRef.current.value = pendingInput
      inputRef.current = pendingInput
      textareaRef.current.focus()
      onClearPendingInput?.()
    }
  }, [pendingInput, onClearPendingInput])

  const handleSend = () => {
    const value = textareaRef.current?.value.trim()
    if (!value || isStreaming || disabled) return
    onSend(value)
    if (textareaRef.current) {
      textareaRef.current.value = ""
      inputRef.current = ""
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border p-3">
      {/* Retry button - show when not streaming and last message is from assistant */}
      {!isStreaming && !disabled && hasMessages && lastMessageIsAssistant && (
        <div className="flex justify-center mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5 text-muted-foreground"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          onChange={(e) => {
            inputRef.current = e.target.value
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Navigate to the correct page to continue this chat..."
              : "Ask about team building, sets, damage calcs..."
          }
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
          disabled={isStreaming || disabled}
        />
        {isStreaming ? (
          <Button
            onClick={onStop}
            size="icon"
            variant="destructive"
            className="flex-shrink-0 h-[44px] w-[44px]"
            title="Stop generation"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            size="icon"
            className="flex-shrink-0 h-[44px] w-[44px]"
            disabled={disabled}
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
