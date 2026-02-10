vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: vi.fn() } };
      constructor(_opts?: Record<string, unknown>) {}
    },
  };
});

describe("openai-client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  it("getOpenAI returns an OpenAI client instance", async () => {
    const { getOpenAI } = await import("./openai-client");
    const client = getOpenAI();
    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
  });

  it("getOpenAI returns the same instance on repeated calls", async () => {
    const { getOpenAI } = await import("./openai-client");
    const a = getOpenAI();
    const b = getOpenAI();
    expect(a).toBe(b);
  });

  it("openai proxy delegates to lazy instance", async () => {
    const { openai } = await import("./openai-client");
    expect(openai.chat).toBeDefined();
  });

  it("MODEL reads from environment variable", async () => {
    const { MODEL } = await import("./openai-client");
    expect(MODEL).toBe("test-model");
  });

  it("MODEL defaults to gpt-4o when env not set", async () => {
    delete process.env.OPENAI_MODEL;
    vi.resetModules();
    const { MODEL } = await import("./openai-client");
    expect(MODEL).toBe("gpt-4o");
  });
});
