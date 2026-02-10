"use client";

import { useState, useCallback } from "react";
import { useTeam } from "@/features/teams/hooks/use-teams";

export function useTeamBuilder(teamId: string) {
  const teamQuery = useTeam(teamId);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const selectSlot = useCallback((position: number | null) => {
    setSelectedSlot(position);
  }, []);

  const selectedSlotData =
    selectedSlot !== null
      ? teamQuery.data?.slots.find((s) => s.position === selectedSlot) ?? null
      : null;

  return {
    team: teamQuery.data ?? null,
    isLoading: teamQuery.isLoading,
    error: teamQuery.error,
    selectedSlot,
    selectedSlotData,
    selectSlot,
    refetch: teamQuery.refetch,
  };
}
