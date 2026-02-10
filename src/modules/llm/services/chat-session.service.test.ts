vi.mock("@/shared/services/prisma", () => ({
  prisma: {
    chatSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/shared/services/prisma";
import {
  createSession,
  getSession,
  listSessions,
  addMessage,
} from "./chat-session.service";

const mockSessionCreate = prisma.chatSession.create as ReturnType<typeof vi.fn>;
const mockSessionFindUnique = prisma.chatSession.findUnique as ReturnType<typeof vi.fn>;
const mockSessionFindMany = prisma.chatSession.findMany as ReturnType<typeof vi.fn>;
const mockSessionUpdate = prisma.chatSession.update as ReturnType<typeof vi.fn>;
const mockMessageCreate = prisma.chatMessage.create as ReturnType<typeof vi.fn>;

const now = new Date("2025-01-15T12:00:00Z");

function makeDbSession(overrides?: Partial<{
  id: string;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: number;
    role: string;
    content: string;
    toolCalls: string | null;
    createdAt: Date;
  }>;
}>) {
  return {
    id: "session-1",
    teamId: null,
    createdAt: now,
    updatedAt: now,
    messages: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  it("creates a session without teamId", async () => {
    mockSessionCreate.mockResolvedValue(makeDbSession());
    const result = await createSession();
    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: { teamId: null },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    expect(result.id).toBe("session-1");
    expect(result.teamId).toBeUndefined();
    expect(result.messages).toEqual([]);
  });

  it("creates a session with teamId", async () => {
    mockSessionCreate.mockResolvedValue(makeDbSession({ teamId: "team-1" }));
    const result = await createSession("team-1");
    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: { teamId: "team-1" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    expect(result.teamId).toBe("team-1");
  });

  it("maps messages with tool calls", async () => {
    mockSessionCreate.mockResolvedValue(
      makeDbSession({
        messages: [
          {
            id: 1,
            role: "assistant",
            content: "Here is info",
            toolCalls: JSON.stringify([{ name: "search", args: {} }]),
            createdAt: now,
          },
        ],
      })
    );
    const result = await createSession();
    expect(result.messages[0].toolCalls).toEqual([
      { name: "search", args: {} },
    ]);
  });

  it("maps messages without tool calls", async () => {
    mockSessionCreate.mockResolvedValue(
      makeDbSession({
        messages: [
          { id: 1, role: "user", content: "hello", toolCalls: null, createdAt: now },
        ],
      })
    );
    const result = await createSession();
    expect(result.messages[0].toolCalls).toBeUndefined();
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("hello");
  });
});

describe("getSession", () => {
  it("returns null for non-existent session", async () => {
    mockSessionFindUnique.mockResolvedValue(null);
    const result = await getSession("nope");
    expect(result).toBeNull();
  });

  it("returns mapped session", async () => {
    mockSessionFindUnique.mockResolvedValue(makeDbSession());
    const result = await getSession("session-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("session-1");
    expect(result!.createdAt).toBe(now.toISOString());
  });
});

describe("listSessions", () => {
  it("lists all sessions when no teamId", async () => {
    mockSessionFindMany.mockResolvedValue([makeDbSession()]);
    const result = await listSessions();
    expect(mockSessionFindMany).toHaveBeenCalledWith({
      where: {},
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toHaveLength(1);
  });

  it("filters by teamId", async () => {
    mockSessionFindMany.mockResolvedValue([]);
    await listSessions("team-1");
    expect(mockSessionFindMany).toHaveBeenCalledWith({
      where: { teamId: "team-1" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    });
  });
});

describe("addMessage", () => {
  it("creates message and updates session", async () => {
    mockMessageCreate.mockResolvedValue({ id: 1 });
    mockSessionUpdate.mockResolvedValue({});

    await addMessage("session-1", {
      role: "user",
      content: "hello",
    });

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        role: "user",
        content: "hello",
        toolCalls: null,
      },
    });
    expect(mockSessionUpdate).toHaveBeenCalled();
  });

  it("serializes tool calls to JSON", async () => {
    mockMessageCreate.mockResolvedValue({ id: 1 });
    mockSessionUpdate.mockResolvedValue({});

    const toolCalls = [{ name: "search", arguments: { q: "pikachu" } }];
    await addMessage("session-1", {
      role: "assistant",
      content: "found it",
      toolCalls,
    });

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        role: "assistant",
        content: "found it",
        toolCalls: JSON.stringify(toolCalls),
      },
    });
  });

  it("handles undefined toolCalls", async () => {
    mockMessageCreate.mockResolvedValue({ id: 1 });
    mockSessionUpdate.mockResolvedValue({});

    await addMessage("session-1", {
      role: "user",
      content: "test",
      toolCalls: undefined,
    });

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        role: "user",
        content: "test",
        toolCalls: null,
      },
    });
  });
});
