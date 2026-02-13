// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("openai", () => ({
  default: class MockOpenAI {
    apiKey: string
    baseURL: string | undefined
    constructor(opts: { apiKey?: string; baseURL?: string }) {
      this.apiKey = opts.apiKey ?? ""
      this.baseURL = opts.baseURL
    }
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("openai-client", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it("exports getOpenAI and MODEL constant", async () => {
    vi.stubEnv("LLM_API_KEY", "test-key")

    const mod = await import("#llm/openai-client.service")

    expect(mod.getOpenAI).toBeDefined()
    expect(mod.MODEL).toBeDefined()
    expect(typeof mod.MODEL).toBe("string")
  })

  it("defaults to claude-opus-4-6 when no model env is set", async () => {
    const mod = await import("#llm/openai-client.service")

    expect(mod.MODEL).toBe("claude-opus-4-6")
  })

  it("prefers LLM_MODEL over OPENAI_MODEL", async () => {
    vi.stubEnv("LLM_MODEL", "claude-opus-4-6")
    vi.stubEnv("OPENAI_MODEL", "gpt-4o")

    const mod = await import("#llm/openai-client.service")

    expect(mod.MODEL).toBe("claude-opus-4-6")
  })

  it("falls back to OPENAI_MODEL when LLM_MODEL is unset", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-3.5-turbo")

    const mod = await import("#llm/openai-client.service")

    expect(mod.MODEL).toBe("gpt-3.5-turbo")
  })

  it("uses LLM_API_KEY with priority over OPENAI_API_KEY", async () => {
    vi.stubEnv("LLM_API_KEY", "llm-key")
    vi.stubEnv("OPENAI_API_KEY", "openai-key")

    const mod = await import("#llm/openai-client.service")
    const client = mod.getOpenAI()

    expect((client as unknown as { apiKey: string }).apiKey).toBe("llm-key")
  })

  it("falls back to OPENAI_API_KEY when LLM_API_KEY is unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key")

    const mod = await import("#llm/openai-client.service")
    const client = mod.getOpenAI()

    expect((client as unknown as { apiKey: string }).apiKey).toBe("openai-key")
  })

  it("uses 'not-needed' when no API key env is set", async () => {
    const mod = await import("#llm/openai-client.service")
    const client = mod.getOpenAI()

    expect((client as unknown as { apiKey: string }).apiKey).toBe("not-needed")
  })

  it("passes baseURL when LLM_BASE_URL is set", async () => {
    vi.stubEnv("LLM_BASE_URL", "http://localhost:3456/v1")

    const mod = await import("#llm/openai-client.service")
    const client = mod.getOpenAI()

    expect((client as unknown as { baseURL: string }).baseURL).toBe("http://localhost:3456/v1")
  })
})
