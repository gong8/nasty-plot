import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/PokeAPI/sprites/**",
      },
    ],
  },
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  transpilePackages: [
    "@nasty-plot/core",
    "@nasty-plot/db",
    "@nasty-plot/pokemon-data",
    "@nasty-plot/battle-engine",
    "@nasty-plot/analysis",
    "@nasty-plot/damage-calc",
    "@nasty-plot/smogon-data",
    "@nasty-plot/formats",
    "@nasty-plot/data-pipeline",
    "@nasty-plot/recommendations",
    "@nasty-plot/llm",
    "@nasty-plot/teams",
    "@nasty-plot/ui",
  ],
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      })
    }

    return [{ source: "/(.*)", headers: securityHeaders }]
  },
}

export default nextConfig
