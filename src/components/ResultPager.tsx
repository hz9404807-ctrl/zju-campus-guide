import { useEffect, useRef } from 'react'
import { deriveResultPager, resultPageLabel } from '../lib/resultPager'
import './result-pager.css'

type Props = { page: number; total: number; pageSize: number; resultHeadingId: string; onChange: (page: number) => void; disabled?: boolean }

export default function ResultPager({ page, total, pageSize, resultHeadingId, onChange, disabled = false }: Props) {
  const pagination = deriveResultPager(page, total, pageSize)
  const { page: current, pages, items } = pagination
  const requestedPage = useRef<number | null>(null)
  useEffect(() => {
    const requested = requestedPage.current
    requestedPage.current = null
    if (requested !== current) return
    const heading = document.getElementById(resultHeadingId)
    if (!heading) return
    heading.focus({ preventScroll: true })
    // Centering keeps the result title clear of the sticky site navigation.
    heading.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [current, resultHeadingId])
  if (pages <= 1) return null
  function change(nextPage: number) {
    if (disabled || nextPage === current || nextPage < 1 || nextPage > pages) return
    requestedPage.current = nextPage
    onChange(nextPage)
  }
  return <nav className="result-pager result-pager--compact" aria-label="结果分页">
    <span className="result-pager__summary">第 {current} / {pages} 页 · 共 {total} 条</span>
    <div className="result-pager__controls">
      <button className="result-pager__button result-pager__previous" type="button" disabled={disabled || current <= 1} onClick={() => change(current - 1)}>上一页</button>
      <div className="result-pager__pages">
        {items.map((item) => typeof item === 'number'
          ? <button key={item} className="result-pager__button result-pager__number" type="button" aria-label={`第 ${item} 页`} aria-current={item === current ? 'page' : undefined} title={`第 ${item} 页`} disabled={disabled} onClick={() => change(item)}><span aria-hidden="true">{resultPageLabel(item)}</span></button>
          : <span key={item} className="result-pager__gap" aria-hidden="true">…</span>)}
      </div>
      <button className="result-pager__button result-pager__next" type="button" disabled={disabled || current >= pages} onClick={() => change(current + 1)}>下一页</button>
    </div>
  </nav>
}
