export type ResultPagerItem = number | 'start-gap' | 'end-gap'

// Keep the navigation bounded regardless of the number of results.
export function deriveResultPager(page: number, total: number, pageSize: number) {
  const validSize = Number.isFinite(pageSize) && pageSize > 0
  const pages = Number.isFinite(total) && total > 0 && validSize
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.ceil(total / pageSize)))
    : 1
  const current = Number.isSafeInteger(page) && page >= 1 ? Math.min(page, pages) : 1
  let items: ResultPagerItem[]
  if (pages <= 5) items = Array.from({ length: pages }, (_, index) => index + 1)
  else if (current <= 3) items = [1, 2, 3, 'end-gap', pages]
  else if (current >= pages - 2) items = [1, 'start-gap', pages - 2, pages - 1, pages]
  else items = [1, 'start-gap', current, 'end-gap', pages]
  return { page: current, pages, items }
}

// The accessible name retains the exact page number; only very long labels shrink.
export function resultPageLabel(page: number): string {
  if (page < 10_000) return String(page)
  const [divisor, unit] = page >= 1_000_000_000_000 ? [1_000_000_000_000, '万亿']
    : page >= 100_000_000 ? [100_000_000, '亿'] : [10_000, '万']
  return `${Number((page / Number(divisor)).toFixed(1))}${unit}`
}
