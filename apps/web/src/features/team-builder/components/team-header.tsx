"use client"

import { useState } from "react"
import {
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Check,
  X,
  GitFork,
  Archive,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { validateTeam, type TeamData } from "@nasty-plot/core"

interface TeamHeaderProps {
  team: TeamData
  onUpdateName: (name: string) => void
  onDelete: () => void
  onImport: (paste: string) => Promise<void>
  onFork?: (options: { name: string; branchName?: string; notes?: string }) => Promise<void>
  onArchive?: () => void
  onShowVersions?: () => void
}

export function TeamHeader({
  team,
  onUpdateName,
  onDelete,
  onImport,
  onFork,
  onArchive,
  onShowVersions,
}: TeamHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(team.name)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importPaste, setImportPaste] = useState("")
  const [importError, setImportError] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [exportPaste, setExportPaste] = useState("")
  const [exportLoading, setExportLoading] = useState(false)
  const [forkOpen, setForkOpen] = useState(false)
  const [forkName, setForkName] = useState(`${team.name} (fork)`)
  const [forkBranch, setForkBranch] = useState("")
  const [forkNotes, setForkNotes] = useState("")
  const [forkLoading, setForkLoading] = useState(false)

  const validation = validateTeam(team)

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim())
    }
    setEditing(false)
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const res = await fetch(`/api/teams/${team.id}/export`)
      if (!res.ok) throw new Error("Export failed")
      setExportPaste(await res.text())
    } catch {
      setExportPaste("Error exporting team")
    }
    setExportLoading(false)
    setExportOpen(true)
  }

  const handleImportSubmit = async () => {
    if (!importPaste.trim()) return
    setImportError("")
    setImportLoading(true)
    try {
      await onImport(importPaste.trim())
      setImportPaste("")
      setImportOpen(false)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImportLoading(false)
    }
  }

  const handleForkSubmit = async () => {
    if (!forkName.trim() || !onFork) return
    setForkLoading(true)
    try {
      await onFork({
        name: forkName.trim(),
        branchName: forkBranch.trim() || undefined,
        notes: forkNotes.trim() || undefined,
      })
      setForkOpen(false)
    } finally {
      setForkLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Team Name */}
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 w-48"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName()
                if (e.key === "Escape") setEditing(false)
              }}
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setEditing(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">{team.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setEditName(team.name)
                setEditing(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Format Badge */}
      <Badge variant="secondary">{team.formatId}</Badge>

      {/* Validation Status */}
      <Tooltip>
        <TooltipTrigger>
          {validation.valid ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {validation.valid ? (
            <p>Team is valid</p>
          ) : (
            <div className="space-y-1">
              {validation.errors.map((err, i) => (
                <p key={i} className="text-sm">
                  {err.message}
                </p>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Versions */}
        {onShowVersions && (
          <Button variant="outline" size="sm" onClick={onShowVersions}>
            <History className="h-4 w-4 mr-1" /> Versions
          </Button>
        )}

        {/* Fork */}
        {onFork && (
          <Dialog
            open={forkOpen}
            onOpenChange={(open) => {
              setForkOpen(open)
              if (open) {
                setForkName(`${team.name} (fork)`)
                setForkBranch("")
                setForkNotes("")
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <GitFork className="h-4 w-4 mr-1" /> Fork
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fork Team</DialogTitle>
                <DialogDescription>
                  Create a copy of this team to experiment with changes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={forkName}
                    onChange={(e) => setForkName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Branch Label</label>
                  <Input
                    value={forkBranch}
                    onChange={(e) => setForkBranch(e.target.value)}
                    placeholder="e.g., anti-stall variant"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={forkNotes}
                    onChange={(e) => setForkNotes(e.target.value)}
                    placeholder="Optional notes about this variant"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleForkSubmit} disabled={!forkName.trim() || forkLoading}>
                  {forkLoading ? "Forking..." : "Fork & Edit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Import */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Showdown Paste</DialogTitle>
              <DialogDescription>
                Paste your Pokemon Showdown team export below. This will replace the current
                team&apos;s Pokemon.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder={"Garganacl @ Leftovers\nAbility: Purifying Salt\n..."}
              value={importPaste}
              onChange={(e) => {
                setImportPaste(e.target.value)
                if (importError) setImportError("")
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleImportSubmit()
                }
              }}
              rows={10}
              className="font-mono text-sm"
            />
            {importError && <p className="text-sm text-destructive">{importError}</p>}
            <DialogFooter>
              <p className="text-xs text-muted-foreground mr-auto self-center">
                Press ⌘+Enter / Ctrl+Enter to import
              </p>
              <Button onClick={handleImportSubmit} disabled={!importPaste.trim() || importLoading}>
                {importLoading ? "Importing..." : "Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={team.slots.length === 0}
            >
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Showdown Paste</DialogTitle>
              <DialogDescription>
                Copy the paste below to import into Pokemon Showdown.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={exportLoading ? "Loading..." : exportPaste}
              readOnly
              rows={12}
              className="font-mono text-sm"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <DialogFooter>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(exportPaste)
                }}
              >
                Copy to Clipboard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archive */}
        {onArchive && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Archive className="h-4 w-4 mr-1" /> Archive
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archive Team</DialogTitle>
                <DialogDescription>
                  Archive &ldquo;{team.name}&rdquo;? It will be hidden from your team list but can
                  be restored later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={onArchive}>Archive Team</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Team</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &ldquo;{team.name}&rdquo;? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="destructive" onClick={onDelete}>
                Delete Team
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
