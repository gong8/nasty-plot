import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ChatSessionData } from "@nasty-plot/core"
import { fetchJson, fetchApiData, postApiData } from "@/lib/api-client"

const SESSIONS_KEY = ["chat-sessions"]

export function useChatSession(id: string | null) {
  return useQuery<ChatSessionData>({
    queryKey: ["chat-session", id],
    queryFn: () => fetchApiData<ChatSessionData>(`/api/chat/sessions/${id}`),
    enabled: !!id,
  })
}

export function useChatSessions() {
  return useQuery<ChatSessionData[]>({
    queryKey: SESSIONS_KEY,
    queryFn: () => fetchApiData<ChatSessionData[]>("/api/chat/sessions"),
  })
}

export function useCreateChatSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (teamId?: string) => postApiData<ChatSessionData>("/api/chat/sessions", { teamId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/chat/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

export function useUpdateChatSessionTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      fetchApiData<ChatSessionData>(`/api/chat/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}
