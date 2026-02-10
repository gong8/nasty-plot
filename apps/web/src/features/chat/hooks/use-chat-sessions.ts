import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChatSessionData, ApiResponse } from "@nasty-plot/core";

const SESSIONS_KEY = ["chat-sessions"];

export function useChatSessions() {
  return useQuery<ChatSessionData[]>({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data: ApiResponse<ChatSessionData[]> = await res.json();
      return data.data;
    },
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId?: string) => {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data: ApiResponse<ChatSessionData> = await res.json();
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete session");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useUpdateChatSessionTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to update session");
      const data: ApiResponse<ChatSessionData> = await res.json();
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}
