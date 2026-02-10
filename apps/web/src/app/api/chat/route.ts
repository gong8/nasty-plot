import { NextRequest } from "next/server";
import {
  streamChat,
  createSession,
  getSession,
  addMessage,
  deleteLastAssistantMessage,
  updateSession,
} from "@nasty-plot/llm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      message,
      teamId,
      formatId,
      context,
      regenerate,
    }: {
      sessionId?: string;
      message: string;
      teamId?: string;
      formatId?: string;
      context?: { pageType: string; contextSummary: string; teamId?: string; pokemonId?: string; formatId?: string };
      regenerate?: boolean;
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

    // Handle regenerate: remove last assistant message
    if (regenerate) {
      await deleteLastAssistantMessage(currentSessionId);
    } else {
      // Save user message
      await addMessage(currentSessionId, { role: "user", content: message });
    }

    // Build message history
    const session = await getSession(currentSessionId);
    const messages = session?.messages ?? [{ role: "user" as const, content: message }];

    // Use abort signal from request for stop generation
    const signal = req.signal;

    // Stream response
    const stream = await streamChat({
      messages,
      teamId: teamId || context?.teamId,
      formatId: formatId || context?.formatId,
      signal,
      context,
    });

    // Collect the full response for saving
    const [streamForClient, streamForSave] = stream.tee();

    // Save assistant response in the background
    collectAndSave(streamForSave, currentSessionId).catch(console.error);

    // Fire-and-forget title generation after first exchange
    if (!sessionId && !regenerate) {
      generateTitleInBackground(currentSessionId, message).catch(console.error);
    }

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

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content" && parsed.content) {
            fullContent += parsed.content;
          }
          // Legacy format fallback
          if (!parsed.type && parsed.content) {
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

async function generateTitleInBackground(sessionId: string, firstMessage: string) {
  try {
    // Generate a concise title from the first message.
    // Strip markdown, take first sentence or meaningful fragment (max ~60 chars).
    let title = firstMessage
      .replace(/[#*_`~\[\]()>]/g, "") // strip markdown
      .replace(/\s+/g, " ")           // collapse whitespace
      .trim();

    // Try to use the first sentence
    const sentenceEnd = title.search(/[.!?]/);
    if (sentenceEnd > 0 && sentenceEnd <= 60) {
      title = title.slice(0, sentenceEnd + 1);
    } else if (title.length > 50) {
      // Break at word boundary
      const truncated = title.slice(0, 50);
      const lastSpace = truncated.lastIndexOf(" ");
      title = (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "...";
    }

    await updateSession(sessionId, { title });
  } catch (error) {
    console.error("Error generating title:", error);
  }
}
