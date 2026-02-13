"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { User, Copy, Check } from "lucide-react"
import { useState, useCallback } from "react"
import { cn } from "@nasty-plot/ui"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

const COPY_FEEDBACK_MS = 2000

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="flex-shrink-0 rounded-full flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground">
          <User className="w-4 h-4" />
        </div>
        <div className="max-w-[80%] min-w-0 rounded-lg px-4 py-2 text-sm whitespace-pre-wrap break-words bg-primary text-primary-foreground">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 flex-row">
      <div className="flex-shrink-0 rounded-full flex items-center justify-center w-9 h-9 bg-accent/15 text-accent">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PECHARUNT_SPRITE_URL}
          alt="Pecharunt"
          width={24}
          height={24}
          className="pixelated"
        />
      </div>
      <div className="min-w-0 flex-1 rounded-lg px-4 py-2 text-sm bg-muted/50 dark:bg-primary/10 border border-border text-foreground overflow-hidden">
        {!content && isStreaming ? (
          <span className="opacity-50">Pecharunt is scheming...</span>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-code:text-xs">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "")
                  const codeStr = String(children).replace(/\n$/, "")

                  if (match) {
                    return (
                      <div className="relative group overflow-x-auto">
                        <CopyButton text={codeStr} />
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: "0.375rem",
                            fontSize: "0.75rem",
                          }}
                        >
                          {codeStr}
                        </SyntaxHighlighter>
                      </div>
                    )
                  }
                  return (
                    <code
                      className={cn("px-1 py-0.5 rounded bg-muted font-mono text-xs", className)}
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-xs border-collapse">{children}</table>
                    </div>
                  )
                },
                th({ children }) {
                  return (
                    <th className="border border-border px-2 py-1 bg-muted/50 font-semibold text-left">
                      {children}
                    </th>
                  )
                },
                td({ children }) {
                  return <td className="border border-border px-2 py-1">{children}</td>
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {children}
                    </a>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
