import OpenAI from "openai"
import { MODEL } from "./config"

export { MODEL }

let _openai: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY
    const isProxyMode = !!process.env.LLM_BASE_URL

    if (!apiKey && !isProxyMode) {
      throw new Error(
        "No LLM API key configured. Set LLM_API_KEY or OPENAI_API_KEY, " +
          "or set LLM_BASE_URL to use a local proxy that does not require a key.",
      )
    }

    _openai = new OpenAI({
      baseURL: process.env.LLM_BASE_URL || undefined,
      // When using a local proxy (LLM_BASE_URL is set), a key is not required.
      // The OpenAI SDK requires a non-empty string, so we pass a placeholder.
      apiKey: apiKey || "proxy-mode-no-key-required",
    })
  }
  return _openai
}
