"use client";

import { useState } from "react";
import {
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { validateTeam } from "@/modules/teams/services/validation.service";
import type { TeamData } from "@/shared/types";

interface TeamHeaderProps {
  team: TeamData;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onImport: (paste: string) => void;
}

export function TeamHeader({
  team,
  onUpdateName,
  onDelete,
  onImport,
}: TeamHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importPaste, setImportPaste] = useState("");
  const [exportPaste, setExportPaste] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  const validation = validateTeam(team);

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim());
    }
    setEditing(false);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/export`);
      if (res.ok) {
        const text = await res.text();
        setExportPaste(text);
      }
    } catch {
      setExportPaste("Error exporting team");
    }
    setExportLoading(false);
    setExportOpen(true);
  };

  const handleImportSubmit = () => {
    if (importPaste.trim()) {
      onImport(importPaste.trim());
      setImportPaste("");
      setImportOpen(false);
    }
  };

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
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setEditing(false);
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
                setEditName(team.name);
                setEditing(true);
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
                Paste your Pokemon Showdown team export below.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder={"Garganacl @ Leftovers\nAbility: Purifying Salt\n..."}
              value={importPaste}
              onChange={(e) => setImportPaste(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <Button onClick={handleImportSubmit} disabled={!importPaste.trim()}>
              Import
            </Button>
          </DialogContent>
        </Dialog>

        {/* Export */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={handleExport}>
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
                  navigator.clipboard.writeText(exportPaste);
                }}
              >
                Copy to Clipboard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Team</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &ldquo;{team.name}&rdquo;? This
                action cannot be undone.
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
  );
}
