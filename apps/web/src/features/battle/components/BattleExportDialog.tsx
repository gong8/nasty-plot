"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Copy, Download } from "lucide-react"

interface BattleExportDialogProps {
  battleId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BattleExportDialog({ battleId, open, onOpenChange }: BattleExportDialogProps) {
  const [logContent, setLogContent] = useState("")
  const [jsonContent, setJsonContent] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !battleId) return
    let cancelled = false

    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true)
        return Promise.all([
          fetch(`/api/battles/${battleId}/export?format=showdown`).then((r) => r.text()),
          fetch(`/api/battles/${battleId}/export?format=json`).then((r) => r.json()),
        ])
      })
      .then(([log, json]) => {
        if (cancelled) return
        setLogContent(log)
        setJsonContent(JSON.stringify(json, null, 2))
      })
      .catch(() => {
        if (cancelled) return
        setLogContent("Error loading battle log")
        setJsonContent("{}")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, battleId])

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Export Battle</DialogTitle>
          <DialogDescription>
            Download or copy the battle log in your preferred format.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">Showdown Log</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="log" className="space-y-3">
            <Textarea
              value={loading ? "Loading..." : logContent}
              readOnly
              rows={12}
              className="font-mono text-xs"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => handleCopy(logContent)}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button
                size="sm"
                onClick={() => handleDownload(logContent, `battle-${battleId}.log`, "text/plain")}
              >
                <Download className="h-4 w-4 mr-1" /> Download .log
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="json" className="space-y-3">
            <Textarea
              value={loading ? "Loading..." : jsonContent}
              readOnly
              rows={12}
              className="font-mono text-xs"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => handleCopy(jsonContent)}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  handleDownload(jsonContent, `battle-${battleId}.json`, "application/json")
                }
              >
                <Download className="h-4 w-4 mr-1" /> Download .json
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
