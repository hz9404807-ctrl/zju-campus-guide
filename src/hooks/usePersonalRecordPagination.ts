import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { parseResultPage } from '../lib/resultPagination'
import { personalRecordsPageSize } from '../lib/personalRecords'

/** Pagination is presentational; personal reads remain restricted by the existing service/RLS. */
export function usePersonalRecordPagination(total: number | null) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const raw = params.get('page')
  const page = parseResultPage(raw, total ?? 0, personalRecordsPageSize)
  useEffect(() => {
    // Wait for the real result count before clamping a deep-linked page.
    if (total === null || raw === null || raw === String(page)) return
    const next = new URLSearchParams(params)
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    setParams(next, { replace: true })
  }, [total, raw, page, params, setParams])
  function change(nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setParams(next)
  }
  return { page, pageSize: personalRecordsPageSize, change, returnUrl: `${location.pathname}${page > 1 ? `?page=${page}` : ''}` }
}
