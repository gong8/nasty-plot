import { FORMAT_DEFINITIONS } from "./data/format-definitions"

/**
 * Resolves a raw format ID (e.g. from Showdown/Replays) to a supported internal format ID.
 *
 * Examples:
 * - "gen9vgc2026regfbo3" -> "gen9vgc2026"
 * - "gen9vgc2025regg" -> "gen9vgc2025"
 * - "gen9ou" -> "gen9ou"
 */
export function resolveFormatId(rawId: string): string | null {
  const normalizedId = rawId.toLowerCase().trim()

  // 1. Check for exact match first (Fast path)
  const exactMatch = FORMAT_DEFINITIONS.find((f) => f.id === normalizedId)
  if (exactMatch) return exactMatch.id

  // 2. Handle VGC Pattern: gen9vgc{YEAR}{...}
  // This allows us to map "gen9vgc2026regfbo3" -> "gen9vgc2026"
  if (normalizedId.startsWith("gen9vgc")) {
    // Explicitly handle Reg I which is a separate supported format
    if (normalizedId.includes("regi") && normalizedId.includes("2026")) {
      return "gen9vgc2026regi"
    }

    // Extract the year (e.g. 2024, 2025, 2026)
    const yearMatch = normalizedId.match(/gen9vgc(\d{4})/)
    if (yearMatch) {
      const year = yearMatch[1]
      const targetId = `gen9vgc${year}`
      // Verify we actually support this year
      const supportedVgc = FORMAT_DEFINITIONS.find((f) => f.id === targetId)
      if (supportedVgc) return supportedVgc.id
    }
  }

  // 3. Handle Battle Stadium Pattern
  // Map "gen9battlestadiumsinglesreg..." -> "gen9battlestadiumsingles"
  if (normalizedId.startsWith("gen9battlestadiumsingles")) {
    return "gen9battlestadiumsingles"
  }
  if (normalizedId.startsWith("gen9battlestadiumdoubles")) {
    return "gen9battlestadiumdoubles"
  }

  // 4. Handle "doublesou" alias
  // Showdown sometimes uses "gen9doublesou" which we support, but just in case of suffixes
  if (normalizedId.startsWith("gen9doublesou")) {
    return "gen9doublesou"
  }

  // 5. Generic Prefix Match (Last Resort)
  // If we have "gen9ou-something", map to "gen9ou"
  // Be careful not to match "gen9ou" against "gen9ubers" (prefix overlap check)
  // We sort definitions by length descending to match "gen9nationaldexuu" before "gen9nationaldex"
  const sortedDefs = [...FORMAT_DEFINITIONS].sort((a, b) => b.id.length - a.id.length)

  for (const def of sortedDefs) {
    if (normalizedId.startsWith(def.id)) {
      return def.id
    }
  }

  return null
}

/**
 * Build a prioritized list of format IDs to try for data lookup.
 * Handles VGC regulation suffixes, bo3/bo5 stripping, year fallbacks,
 * and game-type fallbacks.
 *
 * Examples:
 * - "gen9vgc2026regfbo3" -> ["gen9vgc2026", "gen9vgc2025", "gen9vgc2024", "gen9vgc2023", "gen9doublesou", "gen9battlestadiumdoubles"]
 * - "gen9ou-bo3" -> ["gen9ou"]
 * - "gen9uu" -> ["gen9uu", "gen9ou"]
 */
export function getFormatFallbacks(rawId: string): string[] {
  const candidates: string[] = []
  const lower = rawId.toLowerCase().trim()

  // 1. Try resolving the raw ID first
  const resolved = resolveFormatId(lower)
  if (resolved) candidates.push(resolved)

  // 2. Strip bo3/bo5 suffix and try again
  const strippedBo = lower.replace(/-?bo\d+$/, "")
  if (strippedBo !== lower) {
    const resolvedBo = resolveFormatId(strippedBo)
    if (resolvedBo) candidates.push(resolvedBo)
  }

  // 3. Strip regulation suffix and try again
  const strippedReg = strippedBo.replace(/reg[a-z]$/, "")
  if (strippedReg !== strippedBo) {
    const resolvedReg = resolveFormatId(strippedReg)
    if (resolvedReg) candidates.push(resolvedReg)
  }

  // 4. VGC year fallbacks: try previous years
  const vgcMatch = (resolved ?? strippedReg).match(/^(gen\d+vgc)(\d{4})/)
  if (vgcMatch) {
    const base = vgcMatch[1]
    const year = parseInt(vgcMatch[2], 10)
    for (let y = year - 1; y >= year - 3; y--) {
      const fallback = resolveFormatId(`${base}${y}`)
      if (fallback) candidates.push(fallback)
    }
  }

  // 5. Game type fallbacks
  if (
    lower.includes("vgc") ||
    lower.includes("doubles") ||
    lower.includes("battlestadiumdoubles")
  ) {
    candidates.push("gen9doublesou", "gen9battlestadiumdoubles")
  } else if (lower.includes("nationaldex")) {
    candidates.push("gen9nationaldex")
  } else {
    candidates.push("gen9ou")
  }

  // Deduplicate while preserving order
  return [...new Set(candidates)]
}
