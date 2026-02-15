interface EnvConfig {
  DATABASE_URL: string
  SEED_SECRET?: string
  NEXTAUTH_SECRET?: string
  NEXTAUTH_URL?: string
  LLM_BASE_URL?: string
  LLM_MODEL?: string
  LLM_API_KEY?: string
  OPENAI_API_KEY?: string
  MCP_URL?: string
  MCP_PORT?: string
  ALLOWED_ORIGINS?: string
  NODE_ENV?: string
}

export function validateEnv(): EnvConfig {
  const isProd = process.env.NODE_ENV === "production"
  const errors: string[] = []
  const warnings: string[] = []

  // Always required
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL")
  }

  // Required in production
  const prodRequired = ["NEXTAUTH_SECRET", "SEED_SECRET", "NEXTAUTH_URL"] as const
  for (const key of prodRequired) {
    if (!process.env[key]) {
      if (isProd) {
        errors.push(key)
      } else {
        warnings.push(`${key} is not set (required in production)`)
      }
    }
  }

  // Required for LLM features — at least one API key
  if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
    warnings.push(
      "Neither LLM_API_KEY nor OPENAI_API_KEY is set — LLM features will be unavailable",
    )
  }

  // Optional vars — warn if missing in dev
  const optional = ["LLM_BASE_URL", "LLM_MODEL", "MCP_URL", "MCP_PORT", "ALLOWED_ORIGINS"] as const
  for (const key of optional) {
    if (!process.env[key]) {
      warnings.push(`${key} is not set`)
    }
  }

  // Log warnings in dev, throw errors in prod
  for (const msg of warnings) {
    console.warn(`[env] ${msg}`)
  }

  if (errors.length > 0) {
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`)
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    SEED_SECRET: process.env.SEED_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MCP_URL: process.env.MCP_URL,
    MCP_PORT: process.env.MCP_PORT,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
  }
}
