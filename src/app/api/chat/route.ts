import { NextRequest } from "next/server";
import { streamChat } from "@/modules/llm/services/chat.service";
import {
  createSession,
  getSession,
  addMessage,
} from "@/modules/llm/services/chat-session.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      message,
      teamId,
      formatId,
    }: {
      sessionId?: string;
      message: string;
      teamId?: string;
      formatId?: string;
    } = body;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "message is required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // Get or create session
    let currentSessionId = sessionId;
    if (currentSessionId) {
      const existing = await getSession(currentSessionId);
      if (!existing) {
        return Response.json(
          { error: "Session not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
    } else {
      const session = await createSession(teamId);
      currentSessionId = session.id;
    }

    // Save user message
    await addMessage(currentSessionId, { role: "user", content: message });

    // Build message history
    const session = await getSession(currentSessionId);
    const messages = session?.messages ?? [{ role: "user" as const, content: message }];

    // Stream response
    const stream = await streamChat({ messages, teamId, formatId });

    // Collect the full response for saving
    const [streamForClient, streamForSave] = stream.tee();

    // Save assistant response in the background
    collectAndSave(streamForSave, currentSessionId).catch(console.error);

    return new Response(streamForClient, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Session-Id": currentSessionId,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

async function collectAndSave(
  stream: ReadableStream<Uint8Array>,
  sessionId: string
) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let fullContent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            fullContent += parsed.content;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }

    if (fullContent) {
      await addMessage(sessionId, {
        role: "assistant",
        content: fullContent,
      });
    }
  } catch (error) {
    console.error("Error saving assistant message:", error);
  }
}
