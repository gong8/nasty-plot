"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCreateTeam } from "@/modules/teams/hooks/use-teams";

const COMMON_FORMATS = [
  { id: "gen9ou", name: "Gen 9 OU" },
  { id: "gen9uu", name: "Gen 9 UU" },
  { id: "gen9ru", name: "Gen 9 RU" },
  { id: "gen9nu", name: "Gen 9 NU" },
  { id: "gen9ubers", name: "Gen 9 Ubers" },
  { id: "gen9lc", name: "Gen 9 LC" },
  { id: "gen9monotype", name: "Gen 9 Monotype" },
  { id: "gen9nationaldex", name: "Gen 9 National Dex" },
  { id: "gen9vgc2025", name: "VGC 2025" },
  { id: "gen9vgc2024", name: "VGC 2024" },
  { id: "gen9doublesou", name: "Gen 9 Doubles OU" },
  { id: "gen9battlestadiumsingles", name: "Battle Stadium Singles" },
  { id: "gen9battlestadiumdoubles", name: "Battle Stadium Doubles" },
];

type BuilderMode = "freeform" | "guided";

export default function NewTeamPage() {
  const router = useRouter();
  const createTeam = useCreateTeam();
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState("gen9ou");
  const [mode, setMode] = useState<BuilderMode>("freeform");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const team = await createTeam.mutateAsync({
        name: name.trim(),
        formatId,
        mode,
      });
      if (mode === "guided") {
        router.push(`/teams/${team.id}/guided`);
      } else {
        router.push(`/teams/${team.id}`);
      }
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div className="container mx-auto max-w-md py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Create New Team</CardTitle>
          <CardDescription>
            Set up a new competitive team to start building
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              placeholder="e.g. Rain Offense"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Select value={formatId} onValueChange={setFormatId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_FORMATS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Builder mode toggle */}
          <div className="space-y-2">
            <Label>Builder Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-all",
                  mode === "freeform"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => setMode("freeform")}
              >
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Freeform</p>
                  <p className="text-xs text-muted-foreground">
                    Pick Pokemon manually
                  </p>
                </div>
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-all",
                  mode === "guided"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => setMode("guided")}
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Guided</p>
                  <p className="text-xs text-muted-foreground">
                    Step-by-step with recommendations
                  </p>
                </div>
              </button>
            </div>
          </div>

          {createTeam.isError && (
            <p className="text-sm text-destructive">
              {createTeam.error?.message || "Failed to create team"}
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!name.trim() || createTeam.isPending}
          >
            {createTeam.isPending ? "Creating..." : "Create Team"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
