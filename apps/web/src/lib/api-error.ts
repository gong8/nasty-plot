import { NextResponse } from "next/server"

export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  return error instanceof Error ? error.message : fallback
}

/**
 * Build a standard error JSON response from a caught error.
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
