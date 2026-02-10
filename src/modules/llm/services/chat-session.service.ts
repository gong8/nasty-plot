import { prisma } from "@/shared/services/prisma";
import type { ChatMessage, ChatSessionData } from "@/shared/types";

export async function createSession(
  teamId?: string
): Promise<ChatSessionData> {
  const session = await prisma.chatSession.create({
    data: { teamId: teamId ?? null },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return mapSession(session);
}

export async function getSession(
  id: string
): Promise<ChatSessionData | null> {
  const session = await prisma.chatSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!session) return null;
  return mapSession(session);
}

export async function listSessions(
  teamId?: string
): Promise<ChatSessionData[]> {
  const where = teamId ? { teamId } : {};
  const sessions = await prisma.chatSession.findMany({
    where,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  return sessions.map(mapSession);
}

export async function addMessage(
  sessionId: string,
  message: Pick<ChatMessage, "role" | "content" | "toolCalls">
): Promise<void> {
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls
        ? JSON.stringify(message.toolCalls)
        : null,
    },
  });

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}

function mapSession(
  session: {
    id: string;
    teamId: string | null;
    createdAt: Date;
    updatedAt: Date;
    messages: {
      id: number;
      role: string;
      content: string;
      toolCalls: string | null;
      createdAt: Date;
    }[];
  }
): ChatSessionData {
  return {
    id: session.id,
    teamId: session.teamId ?? undefined,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role as ChatMessage["role"],
      content: m.content,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
