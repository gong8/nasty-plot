import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ChatSessionData } from "@nasty-plot/core"
import { fetchApiData, postApiData, deleteJson, putApiData } from "@/lib/api-client"

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
    mutationFn: (id: string) => deleteJson(`/api/chat/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

export function useUpdateChatSessionTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      putApiData<ChatSessionData>(`/api/chat/sessions/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}
