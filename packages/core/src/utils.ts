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
