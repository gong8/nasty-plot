/**
 * Quality check scanner — detects banned patterns in TypeScript/TSX source files.
 *
 * Scans for:
 * - eslint-disable / eslint-disable-next-line (unless preceded by // quality:ok)
 * - @ts-ignore / @ts-expect-error / @ts-nocheck
 * - `as any`
 *
 * Exit code 0 if clean, 1 if violations found.
 */

import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  "generated",
  ".turbo",
])

const PATTERNS = [
  { name: "eslint-disable", regex: /eslint-disable(?!.*quality:ok)/ },
  { name: "@ts-ignore", regex: /@ts-ignore/ },
  { name: "@ts-expect-error", regex: /@ts-expect-error/ },
  { name: "@ts-nocheck", regex: /@ts-nocheck/ },
  { name: "as any", regex: /\bas\s+any\b/ },
]

async function* walkTs(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkTs(full)
    } else if (/\.[cm]?tsx?$/.test(entry.name)) {
      yield full
    }
  }
}

async function main() {
  const violations = []
  const counts = {}
  for (const p of PATTERNS) counts[p.name] = 0

  for await (const filePath of walkTs(ROOT)) {
    const content = await readFile(filePath, "utf8")
    const lines = content.split("\n")
    const rel = relative(ROOT, filePath)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check if the previous line has a quality:ok marker
      const prevLine = i > 0 ? lines[i - 1] : ""
      const hasQualityOk = /\/\/\s*quality:ok/.test(prevLine)

      for (const pattern of PATTERNS) {
        if (pattern.regex.test(line)) {
          // For eslint-disable, skip if quality:ok is on the line itself or previous line
          if (pattern.name === "eslint-disable") {
            if (hasQualityOk || /quality:ok/.test(line)) continue
          }
          violations.push({ file: rel, line: i + 1, pattern: pattern.name, content: line.trim() })
          counts[pattern.name]++
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("Quality check passed — no violations found.")
    process.exit(0)
  }

  console.log("Quality check FAILED\n")
  for (const v of violations) {
    console.log(`${v.file}:${v.line}: [${v.pattern}] ${v.content}`)
  }

  console.log("\nSummary:")
  for (const [name, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${name}: ${count}`)
  }
  console.log(`  Total: ${violations.length}`)

  process.exit(1)
}

main()
