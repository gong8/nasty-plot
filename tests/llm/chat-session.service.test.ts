import {
  createSession,
  getSession,
  listSessions,
  addMessage,
  updateSession,
  deleteSession,
  deleteLastAssistantMessage,
} from "@nasty-plot/llm"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    chatSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from "@nasty-plot/db"
const mockedPrisma = vi.mocked(prisma, true)

const mockSessionCreate = mockedPrisma.chatSession.create
const mockSessionFindUnique = mockedPrisma.chatSession.findUnique
const mockSessionFindMany = mockedPrisma.chatSession.findMany
const mockSessionCount = mockedPrisma.chatSession.count
const mockSessionUpdate = mockedPrisma.chatSession.update
const mockSessionDelete = mockedPrisma.chatSession.delete
const mockMessageCreate = mockedPrisma.chatMessage.create
const mockMessageFindFirst = mockedPrisma.chatMessage.findFirst
const mockMessageDelete = mockedPrisma.chatMessage.delete

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbSession(overrides?: Record<string, unknown>) {
  const now = new Date()
  return {
    id: "session-1",
    teamId: null,
    title: null,
    contextMode: null,
    contextData: null,
    createdAt: now,
    updatedAt: now,
    messages: [],
    ...overrides,
  }
}

function makeDbMessage(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    role: "user",
    content: "Hello",
    toolCalls: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a session without teamId", async () => {
    mockSessionCreate.mockResolvedValue(makeDbSession())

    const result = await createSession()

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: { contextMode: null, contextData: null },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })
    expect(result.id).toBe("session-1")
    expect(result.teamId).toBeUndefined()
  })

  it("creates a session with teamId", async () => {
    mockSessionCreate.mockResolvedValue(makeDbSession({ teamId: "team-1" }))

    const result = await createSession("team-1")

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: { team: { connect: { id: "team-1" } }, contextMode: null, contextData: null },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })
    expect(result.teamId).toBe("team-1")
  })

  it("creates a session with context mode", async () => {
    mockSessionCreate.mockResolvedValue(
      makeDbSession({ contextMode: "battle-live", contextData: '{"formatId":"gen9ou"}' }),
    )

    const result = await createSession({
      contextMode: "battle-live",
      contextData: '{"formatId":"gen9ou"}',
    })

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: { contextMode: "battle-live", contextData: '{"formatId":"gen9ou"}' },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })
    expect(result.contextMode).toBe("battle-live")
    expect(result.contextData).toBe('{"formatId":"gen9ou"}')
  })

  it("maps messages correctly", async () => {
    const msg = makeDbMessage({ toolCalls: JSON.stringify([{ name: "test" }]) })
    mockSessionCreate.mockResolvedValue(makeDbSession({ messages: [msg] }))

    const result = await createSession()

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe("user")
    expect(result.messages[0].content).toBe("Hello")
    expect(result.messages[0].toolCalls).toEqual([{ name: "test" }])
  })
})

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns session when found", async () => {
    mockSessionFindUnique.mockResolvedValue(makeDbSession())

    const result = await getSession("session-1")

    expect(result).not.toBeNull()
    expect(result!.id).toBe("session-1")
  })

  it("returns null when session not found", async () => {
    mockSessionFindUnique.mockResolvedValue(null)

    const result = await getSession("nonexistent")

    expect(result).toBeNull()
  })
})

describe("listSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists all sessions when no teamId filter", async () => {
    mockSessionFindMany.mockResolvedValue([makeDbSession()])
    mockSessionCount.mockResolvedValue(1)

    const result = await listSessions()

    expect(mockSessionFindMany).toHaveBeenCalledWith({
      where: {},
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      skip: 0,
      take: 20,
    })
    expect(result.sessions).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it("filters by teamId when provided", async () => {
    mockSessionFindMany.mockResolvedValue([])
    mockSessionCount.mockResolvedValue(0)

    await listSessions("team-1")

    expect(mockSessionFindMany).toHaveBeenCalledWith({
      where: { teamId: "team-1" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      skip: 0,
      take: 20,
    })
  })
})

describe("addMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a message and updates session timestamp", async () => {
    mockMessageCreate.mockResolvedValue({})
    mockSessionUpdate.mockResolvedValue({})

    await addMessage("session-1", { role: "user", content: "Hello" })

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        role: "user",
        content: "Hello",
        toolCalls: null,
        metadata: null,
      },
    })
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { updatedAt: expect.any(Date) },
    })
  })

  it("serializes toolCalls to JSON", async () => {
    mockMessageCreate.mockResolvedValue({})
    mockSessionUpdate.mockResolvedValue({})

    const toolCalls = [{ name: "search", args: { q: "pikachu" } }]
    await addMessage("session-1", {
      role: "assistant",
      content: "Let me search",
      toolCalls,
    })

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        role: "assistant",
        content: "Let me search",
        toolCalls: JSON.stringify(toolCalls),
        metadata: null,
      },
    })
  })
})

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates session title and returns mapped session", async () => {
    mockSessionUpdate.mockResolvedValue(makeDbSession({ title: "New Title" }))

    const result = await updateSession("session-1", { title: "New Title" })

    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { title: "New Title" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })
    expect(result).not.toBeNull()
    expect(result!.id).toBe("session-1")
  })

  it("maps title to undefined when null in DB", async () => {
    mockSessionUpdate.mockResolvedValue(makeDbSession({ title: null }))

    const result = await updateSession("session-1", {})

    expect(result!.title).toBeUndefined()
  })

  it("maps title when present", async () => {
    mockSessionUpdate.mockResolvedValue(makeDbSession({ title: "My Chat" }))

    const result = await updateSession("session-1", { title: "My Chat" })

    expect(result!.title).toBe("My Chat")
  })
})

describe("deleteSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes session by id", async () => {
    mockSessionDelete.mockResolvedValue({})

    await deleteSession("session-1")

    expect(mockSessionDelete).toHaveBeenCalledWith({
      where: { id: "session-1" },
    })
  })
})

describe("deleteLastAssistantMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes the last assistant message when found", async () => {
    mockMessageFindFirst.mockResolvedValue({ id: 42 })
    mockMessageDelete.mockResolvedValue({})

    await deleteLastAssistantMessage("session-1")

    expect(mockMessageFindFirst).toHaveBeenCalledWith({
      where: { sessionId: "session-1", role: "assistant" },
      orderBy: { createdAt: "desc" },
    })
    expect(mockMessageDelete).toHaveBeenCalledWith({
      where: { id: 42 },
    })
  })

  it("does nothing when no assistant message exists", async () => {
    mockMessageFindFirst.mockResolvedValue(null)

    await deleteLastAssistantMessage("session-1")

    expect(mockMessageFindFirst).toHaveBeenCalledWith({
      where: { sessionId: "session-1", role: "assistant" },
      orderBy: { createdAt: "desc" },
    })
    expect(mockMessageDelete).not.toHaveBeenCalled()
  })
})
