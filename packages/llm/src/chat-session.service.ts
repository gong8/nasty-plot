import { prisma } from "@nasty-plot/db"
import type { ChatMessage, ChatRole, ChatSessionData, ChatMessageMetadata } from "@nasty-plot/core"

export interface CreateSessionOptions {
  teamId?: string
  contextMode?: string
  contextData?: string
}

export async function createSession(
  teamIdOrOptions?: string | CreateSessionOptions,
): Promise<ChatSessionData> {
  const options: CreateSessionOptions =
    typeof teamIdOrOptions === "string" ? { teamId: teamIdOrOptions } : (teamIdOrOptions ?? {})

  const session = await prisma.chatSession.create({
    data: {
      ...(options.teamId ? { team: { connect: { id: options.teamId } } } : {}),
      contextMode: options.contextMode ?? null,
      contextData: options.contextData ?? null,
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })

  return mapSession(session)
}

export async function getSession(sessionId: string): Promise<ChatSessionData | null> {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })

  if (!session) return null
  return mapSession(session)
}

export async function listSessions(
  teamId?: string,
  contextMode?: string,
): Promise<ChatSessionData[]> {
  const where: Record<string, unknown> = {}
  if (teamId) where.teamId = teamId
  if (contextMode) where.contextMode = contextMode

  const sessions = await prisma.chatSession.findMany({
    where,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  })

  return sessions.map(mapSession)
}

export async function addMessage(
  sessionId: string,
  message: Pick<ChatMessage, "role" | "content" | "toolCalls" | "metadata">,
): Promise<void> {
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      metadata: message.metadata ? JSON.stringify(message.metadata) : null,
    },
  })

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  })
}

export async function updateSession(
  sessionId: string,
  data: { title?: string },
): Promise<ChatSessionData | null> {
  const session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { title: data.title },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })

  return mapSession(session)
}

export async function deleteSession(sessionId: string): Promise<void> {
  // Messages cascade on delete via schema
  await prisma.chatSession.delete({ where: { id: sessionId } })
}

export async function deleteLastAssistantMessage(sessionId: string): Promise<void> {
  const lastAssistant = await prisma.chatMessage.findFirst({
    where: { sessionId, role: "assistant" },
    orderBy: { createdAt: "desc" },
  })

  if (lastAssistant) {
    await prisma.chatMessage.delete({ where: { id: lastAssistant.id } })
  }
}

interface DbSession {
  id: string
  teamId: string | null
  title: string | null
  contextMode: string | null
  contextData: string | null
  createdAt: Date
  updatedAt: Date
  messages: {
    id: number
    role: string
    content: string
    toolCalls: string | null
    metadata: string | null
    createdAt: Date
  }[]
}

function mapSession(session: DbSession): ChatSessionData {
  return {
    id: session.id,
    teamId: session.teamId ?? undefined,
    title: session.title ?? undefined,
    contextMode: session.contextMode ?? undefined,
    contextData: session.contextData ?? undefined,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role as ChatRole,
      content: m.content,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
      metadata: m.metadata ? (JSON.parse(m.metadata) as ChatMessageMetadata) : undefined,
      createdAt: m.createdAt.toISOString(),
    })),
  }
}
