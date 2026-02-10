// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("openai-client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("exports getOpenAI and MODEL constant", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    vi.mock("openai", () => {
      return {
        default: class MockOpenAI {
          apiKey: string;
          constructor(opts: { apiKey: string }) {
            this.apiKey = opts.apiKey;
          }
        },
      };
    });

    const mod = await import("../openai-client");

    expect(mod.getOpenAI).toBeDefined();
    expect(mod.MODEL).toBeDefined();
    expect(typeof mod.MODEL).toBe("string");
  });

  it("uses OPENAI_MODEL env var when set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-3.5-turbo");

    vi.mock("openai", () => {
      return {
        default: class MockOpenAI {
          constructor() {}
        },
      };
    });

    const mod = await import("../openai-client");

    expect(mod.MODEL).toBe("gpt-3.5-turbo");
  });

  it("getOpenAI returns an OpenAI instance", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    vi.mock("openai", () => {
      return {
        default: class MockOpenAI {
          apiKey: string;
          constructor(opts: { apiKey: string }) {
            this.apiKey = opts.apiKey;
          }
        },
      };
    });

    const mod = await import("../openai-client");
    const client = mod.getOpenAI();

    expect(client).toBeDefined();
    expect((client as unknown as { apiKey: string }).apiKey).toBe("test-key");
  });
});
