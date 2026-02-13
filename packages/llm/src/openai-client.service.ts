import OpenAI from "openai"
import { MODEL } from "./config"

export { MODEL }

let _openai: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: process.env.LLM_BASE_URL || undefined,
      apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "not-needed",
    })
  }
  return _openai
}
