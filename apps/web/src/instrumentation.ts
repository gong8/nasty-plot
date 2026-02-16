export async function register() {
  // Validate environment variables on server startup only
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env")
    validateEnv()
  }
}
