/**
 * Parse an integer query parameter with clamping.
 * Returns `fallback` when the raw value is missing or NaN.
 */
export function parseIntParam(
  raw: string | null,
  fallback: number,
  min?: number,
  max?: number,
): number {
  const parsed = parseInt(raw ?? "", 10)
  let value = Number.isNaN(parsed) ? fallback : parsed
  if (min !== undefined) value = Math.max(min, value)
  if (max !== undefined) value = Math.min(max, value)
  return value
}

/** Standard pagination shape returned by `parsePagination`. */
export interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * Extract `page` and `pageSize` from URL search params with sensible defaults.
 * `page` is clamped to >= 1, `pageSize` is clamped to [1, maxPageSize].
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { pageSize?: number; maxPageSize?: number } = {},
): PaginationParams {
  const { pageSize: defaultPageSize = 50, maxPageSize = 100 } = defaults
  return {
    page: parseIntParam(searchParams.get("page"), 1, 1),
    pageSize: parseIntParam(searchParams.get("pageSize"), defaultPageSize, 1, maxPageSize),
  }
}
