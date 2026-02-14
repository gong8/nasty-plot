import { NextResponse } from "next/server"

export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  return error instanceof Error ? error.message : fallback
}

export function notFoundResponse(entity: string): NextResponse {
  return NextResponse.json({ error: `${entity} not found`, code: "NOT_FOUND" }, { status: 404 })
}

export function badRequestResponse(message: string, code = "BAD_REQUEST"): NextResponse {
  return NextResponse.json({ error: message, code }, { status: 400 })
}

/**
 * Build a standard error JSON response from a caught error.
 * Always logs the error to the console before returning.
 *
 * Basic (always 500):
 *   return apiErrorResponse(error)
 *
 * With "not found" -> 404 inference:
 *   return apiErrorResponse(error, { inferNotFound: true })
 *
 * With client error patterns (-> 400):
 *   return apiErrorResponse(error, { clientErrorPatterns: ["Duplicate move"] })
 *
 * With error code:
 *   return apiErrorResponse(error, { code: "CALC_ERROR", fallback: "Calculation failed" })
 */
export function apiErrorResponse(
  error: unknown,
  options: {
    fallback?: string
    code?: string
    inferNotFound?: boolean
    clientErrorPatterns?: string[]
    status?: number
  } = {},
): NextResponse {
  console.error(error)

  const { fallback, code, inferNotFound, clientErrorPatterns = [], status: forceStatus } = options
  const message = getErrorMessage(error, fallback)

  let status = forceStatus ?? 500
  if (!forceStatus) {
    if (inferNotFound && message.toLowerCase().includes("not found")) {
      status = 404
    } else {
      for (const pattern of clientErrorPatterns) {
        if (message.includes(pattern)) {
          status = 400
          break
        }
      }
    }
  }

  const body: Record<string, string> = { error: message }
  if (code) body.code = code

  return NextResponse.json(body, { status })
}

/** Shorthand for catch blocks in routes where a "not found" service error should map to 404. */
export function entityErrorResponse(error: unknown): NextResponse {
  return apiErrorResponse(error, { inferNotFound: true })
}

/** Shorthand for catch blocks in routes where the error is a generic internal failure. */
export function internalErrorResponse(error: unknown): NextResponse {
  return apiErrorResponse(error, { fallback: "Internal server error", code: "INTERNAL_ERROR" })
}
