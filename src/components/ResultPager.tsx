type Props = { page: number; total: number; pageSize: number; onChange: (page: number) => void }

export default function ResultPager({ page, total, pageSize, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  function change(nextPage: number) {
    onChange(nextPage)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  return <nav className="result-pager" aria-label="结果分页">
    <button type="button" disabled={page <= 1} onClick={() => change(page - 1)}>上一页</button>
    <span>第 {page} / {pages} 页 · 共 {total} 条</span>
    <button type="button" disabled={page >= pages} onClick={() => change(page + 1)}>下一页</button>
  </nav>
}
