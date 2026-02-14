export function normalizeMoveName(name: string): string {
  return name.toLowerCase().replace(/\s/g, "")
}

export function camelCaseToDisplayName(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase())
}

export function toPercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 1000) / 10
}

export function formatUsagePercent(percent: number, decimals = 1): string {
  return `${percent.toFixed(decimals)}%`
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function parseIntQueryParam(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = parseInt(value ?? String(fallback), 10)
  return Math.min(max, Math.max(min, isNaN(parsed) ? fallback : parsed))
}

export function buildParams(
  entries: Record<string, string | number | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      params[key] = String(value)
    }
  }
  return params
}
