import { NextResponse } from "next/server"
import type { z } from "zod"

export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<[T, null] | [null, NextResponse]> {
  try {
    const raw = await request.json()
    const result = schema.safeParse(raw)
    if (!result.success) {
      return [
        null,
        NextResponse.json(
          { error: "Validation failed", details: result.error.flatten().fieldErrors },
          { status: 400 },
        ),
      ]
    }
    return [result.data, null]
  } catch {
    return [null, NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })]
  }
}

export function validateSearchParams<T>(
  url: string | URL,
  schema: z.ZodType<T>,
): [T, null] | [null, NextResponse] {
  const searchParams = new URL(url).searchParams
  const raw = Object.fromEntries(searchParams.entries())
  const result = schema.safeParse(raw)
  if (!result.success) {
    return [
      null,
      NextResponse.json(
        { error: "Invalid query parameters", details: result.error.flatten().fieldErrors },
        { status: 400 },
      ),
    ]
  }
  return [result.data, null]
}
