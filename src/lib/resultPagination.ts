// URL page values must name a whole page, never an arbitrary slice of results.
export function parseResultPage(raw: string | null, total: number, pageSize: number): number {
  const pages = Number.isFinite(total) && total > 0 && Number.isFinite(pageSize) && pageSize > 0
    ? Math.max(1, Math.ceil(total / pageSize))
    : 1
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1
  const requested = Number(raw)
  if (!Number.isSafeInteger(requested)) return 1
  return Math.min(requested, pages)
}
