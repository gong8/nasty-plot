import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: process.env.LLM_BASE_URL || undefined,
      apiKey:
        process.env.LLM_API_KEY ||
        process.env.OPENAI_API_KEY ||
        "not-needed",
    });
  }
  return _openai;
}

export const MODEL =
  process.env.LLM_MODEL ||
  process.env.OPENAI_MODEL ||
  "claude-opus-4-6";
