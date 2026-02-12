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
