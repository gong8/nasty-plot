"use client";

import { useState } from "react";
import { ChatPanel } from "@/features/chat/components/chat-panel";
import { SiteHeader } from "@/components/site-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FORMATS = [
  { id: "gen9ou", name: "Gen 9 OU" },
  { id: "gen9uu", name: "Gen 9 UU" },
  { id: "gen9uber", name: "Gen 9 Ubers" },
  { id: "gen9vgc2024", name: "VGC 2024" },
  { id: "gen9monotype", name: "Gen 9 Monotype" },
  { id: "gen9ru", name: "Gen 9 RU" },
  { id: "gen9nu", name: "Gen 9 NU" },
];

export default function ChatPage() {
  const [formatId, setFormatId] = useState<string | undefined>();

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full p-4 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Team Assistant</h1>
          <Select
            value={formatId ?? ""}
            onValueChange={(v) => setFormatId(v || undefined)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel formatId={formatId} />
        </div>
      </div>
    </div>
  );
}
