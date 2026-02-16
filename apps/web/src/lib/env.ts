import { z } from "zod"

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Optional with validation
  NEXTAUTH_SECRET: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional().or(z.literal("")),
  MCP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  MCP_URL: z
    .string()
    .refine((url) => LOCALHOST_PATTERN.test(url), {
      message: "MCP_URL must be a localhost URL (http://localhost:* or http://127.0.0.1:*)",
    })
    .optional()
    .or(z.literal("")),
  ALLOWED_ORIGINS: z.string().optional(),
})

const DEFAULT_SECRET = "nasty-plot-dev-secret-change-in-production"

let validated = false

export function validateEnv(): void {
  if (validated) return
  validated = true

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs ?? []).join(", ")}`)
      .join("\n")
    throw new Error(`Environment variable validation failed:\n${messages}`)
  }

  // Warn if using the default NEXTAUTH_SECRET
  if (
    result.data.NEXTAUTH_SECRET === DEFAULT_SECRET ||
    process.env.NEXTAUTH_SECRET === DEFAULT_SECRET
  ) {
    console.warn(
      "[env] WARNING: NEXTAUTH_SECRET is set to the default dev value. " +
        "Change it before deploying to production.",
    )
  }
}
