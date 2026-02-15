interface EnvConfig {
  DATABASE_URL: string
  LLM_BASE_URL?: string
  LLM_MODEL?: string
  LLM_API_KEY?: string
  MCP_URL?: string
  SEED_SECRET?: string
}

export function validateEnv(): EnvConfig {
  const missing: string[] = []

  if (!process.env.DATABASE_URL) {
    missing.push("DATABASE_URL")
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  // Warn for optional but commonly needed vars
  const optional = ["LLM_BASE_URL", "LLM_MODEL", "MCP_URL"]
  for (const key of optional) {
    if (!process.env[key]) {
      console.warn(`[env] Optional variable ${key} is not set`)
    }
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    MCP_URL: process.env.MCP_URL,
    SEED_SECRET: process.env.SEED_SECRET,
  }
}
