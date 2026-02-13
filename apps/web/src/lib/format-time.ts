const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const DAYS_PER_WEEK = 7

export function timeAgo(dateStr: string): string {
  const elapsedMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(elapsedMs / MS_PER_MINUTE)
  if (minutes < 1) return "just now"
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  if (hours < HOURS_PER_DAY) return `${hours}h ago`
  const days = Math.floor(hours / HOURS_PER_DAY)
  if (days < DAYS_PER_WEEK) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}
