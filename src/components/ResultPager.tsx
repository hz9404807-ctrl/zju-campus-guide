import { useEffect, useRef } from 'react'

type Props = { page: number; total: number; pageSize: number; resultHeadingId: string; onChange: (page: number) => void }

export default function ResultPager({ page, total, pageSize, resultHeadingId, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const requestedPage = useRef<number | null>(null)
  useEffect(() => {
    const requested = requestedPage.current
    requestedPage.current = null
    if (requested !== page) return
    const heading = document.getElementById(resultHeadingId)
    if (!heading) return
    heading.focus({ preventScroll: true })
    // Centering keeps the result title clear of the sticky site navigation.
    heading.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [page, resultHeadingId])
  if (pages <= 1) return null
  function change(nextPage: number) {
    if (nextPage === page || nextPage < 1 || nextPage > pages) return
    requestedPage.current = nextPage
    onChange(nextPage)
  }
  return <nav className="result-pager" aria-label="结果分页">
    <button type="button" disabled={page <= 1} onClick={() => change(page - 1)}>上一页</button>
    <span>第 {page} / {pages} 页 · 共 {total} 条</span>
    <button type="button" disabled={page >= pages} onClick={() => change(page + 1)}>下一页</button>
  </nav>
}
