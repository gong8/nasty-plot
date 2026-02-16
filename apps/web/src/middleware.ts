import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { checkRateLimit } from "./lib/rate-limit"

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : process.env.NODE_ENV === "production"
      ? []
      : DEV_ORIGINS
).filter((o) => o.startsWith("http://") || o.startsWith("https://"))

function getCorsHeaders(origin: string | null) {
  // Only reflect the origin if it is in the allow list; never fall back to a default origin
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ""
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  }
}

const RATE_LIMITS = {
  seed: { maxRequests: 1, windowMs: 600_000 },
  chat: { maxRequests: 20, windowMs: 60_000 },
  cleanup: { maxRequests: 1, windowMs: 600_000 },
  batchSim: { maxRequests: 5, windowMs: 600_000 },
  auth: { maxRequests: 10, windowMs: 60_000 },
  default: { maxRequests: 100, windowMs: 60_000 },
} as const

function getRateLimitBucket(pathname: string): {
  key: string
  config: { maxRequests: number; windowMs: number }
} {
  if (pathname.startsWith("/api/auth/")) return { key: "auth", config: RATE_LIMITS.auth }
  if (pathname.startsWith("/api/data/seed")) return { key: "seed", config: RATE_LIMITS.seed }
  if (pathname.startsWith("/api/chat")) return { key: "chat", config: RATE_LIMITS.chat }
  if (pathname.startsWith("/api/data/cleanup"))
    return { key: "cleanup", config: RATE_LIMITS.cleanup }
  if (pathname.startsWith("/api/battles/batch"))
    return { key: "batchSim", config: RATE_LIMITS.batchSim }
  return { key: "default", config: RATE_LIMITS.default }
}

/** Routes that do not require authentication. */
function isPublicRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/auth/")) return true
  if (method === "GET" && (pathname === "/api/pokemon" || pathname.startsWith("/api/pokemon/")))
    return true
  if (method === "GET" && (pathname === "/api/formats" || pathname.startsWith("/api/formats/")))
    return true
  if (method === "GET" && pathname === "/api/items") return true
  return false
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin")

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const bucket = getRateLimitBucket(request.nextUrl.pathname)
  const { allowed, retryAfterMs } = checkRateLimit(`${ip}:${bucket.key}`, bucket.config)

  if (!allowed) {
    const retryAfterSeconds = Math.ceil((retryAfterMs ?? bucket.config.windowMs) / 1000)
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          ...getCorsHeaders(origin),
        },
      },
    )
  }

  // Auth check for non-public API routes (skip in development)
  const { pathname } = request.nextUrl
  const authEnabled = process.env.NODE_ENV === "production"
  if (authEnabled && !isPublicRoute(pathname, request.method)) {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: getCorsHeaders(origin) },
      )
    }
  }

  // Add CORS headers to API responses
  const response = NextResponse.next()
  const corsHeaders = getCorsHeaders(origin)
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: "/api/:path*",
}
