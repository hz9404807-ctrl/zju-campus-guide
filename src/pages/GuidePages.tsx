import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, ClipboardList, Info, Search } from 'lucide-react'
import SearchField from '../components/SearchField'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import guideData from '../data/guides.json'
import type { Guide } from '../types/guide'
import './guides.css'

// Keep every replacement JSON entry checked against the same data structure.
const guides: Guide[] = guideData
const quickKeywords = ['校园卡', '场地', '就医']
const unverified = '待补充 / 待核实'

function normalizeSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().trim()
}

function searchGuides(query: string) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return guides

  return guides.filter((guide) => {
    const searchable = normalizeSearch([
      guide.title,
      guide.category,
      ...guide.keywords,
      guide.summary,
    ].join(' '))
    return terms.every((term) => searchable.includes(term))
  })
}

function ExampleNotice() {
  return (
    <aside className="guide-example-notice" aria-label="示例资料提示">
      <Info size={20} aria-hidden="true" />
      <div>
        <strong>本页含示例资料，示例内容待核实</strong>
        <p>用于体验搜索和阅读流程。具体办理信息待补充，请以经核实的最新官方资料为准。</p>
      </div>
    </aside>
  )
}

function ExampleBadge({ isExample }: { isExample: boolean }) {
  return isExample ? <span className="guide-example-badge">示例 · 待核实</span> : null
}

export function GuidePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const debouncedQuery = useDebouncedValue(query, 250)
  const results = searchGuides(debouncedQuery)
  const isUpdating = query !== debouncedQuery
  const queryString = searchParams.toString()
  const detailSearch = queryString ? `?${queryString}` : ''

  function updateQuery(value: string) {
    const nextParams = new URLSearchParams(searchParams)
    if (value) nextParams.set('q', value)
    else nextParams.delete('q')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="page module-page">
      <div className="page-heading">
        <Link to="/" className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回首页</Link>
        <p className="eyebrow">把问题变成清楚的步骤</p>
        <h1>校园办事指南</h1>
        <p className="page-description">不用先知道该进哪个系统，从你遇到的问题开始。</p>
      </div>

      {guides.some((guide) => guide.isExample) && <ExampleNotice />}

      <section className="guide-search-panel" role="search" aria-label="查找校园办事指南">
        <SearchField
          id="guide-search"
          label="你想办什么事？"
          placeholder="搜索问题，例如：校园卡丢了、场地预约"
          value={query}
          onChange={updateQuery}
          hint="输入后自动搜索，可按问题、关键词或分类查找。"
        />
        <div className="guide-quick-search">
          <span>试试这些词</span>
          {quickKeywords.map((keyword) => (
            <button
              key={keyword}
              type="button"
              className="guide-keyword-button"
              onClick={() => updateQuery(keyword)}
            >
              {keyword}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="guide-results-heading" aria-busy={isUpdating}>
        <div className="guide-results-heading">
          <h2 id="guide-results-heading">{normalizeSearch(debouncedQuery) ? '搜索结果' : guides.every((guide) => guide.isExample) ? '问题示例' : '办事问题'}</h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            {isUpdating ? '正在更新结果…' : `找到 ${results.length} 条指南`}
          </p>
        </div>

        {results.length > 0 ? (
          <ul className="guide-result-grid" role="list">
            {results.map((guide) => (
              <li key={guide.id}>
                <Link to={`/guides/${encodeURIComponent(guide.id)}${detailSearch}`} className="guide-result-card">
                  <div className="guide-card-labels">
                    <span className="guide-category">{guide.category}</span>
                    <ExampleBadge isExample={guide.isExample} />
                  </div>
                  <h3>{guide.title}</h3>
                  <p className="guide-card-summary">{guide.summary}</p>
                  <div className="guide-card-footer">
                    <span>最后核验：{guide.verifiedAt ?? '待核验'}</span>
                    <span className="guide-card-action">查看步骤 <ArrowRight size={17} aria-hidden="true" /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="guide-empty-state">
            <span className="guide-empty-icon"><Search size={27} aria-hidden="true" /></span>
            <h3>没有找到相关指南</h3>
            <p>试试缩短关键词，或搜索“校园卡”“场地”“就医”。目前共有 {guides.length} 条指南，更多资料正在整理。</p>
            <button type="button" className="button-link" onClick={() => updateQuery('')}>查看全部指南</button>
          </div>
        )}
      </section>
    </div>
  )
}

export function GuideDetailPage() {
  const { guideId } = useParams()
  const [searchParams] = useSearchParams()
  const guide = guides.find((item) => item.id === guideId)
  const queryString = searchParams.toString()
  const backTo = `/guides${queryString ? `?${queryString}` : ''}`

  if (!guide) {
    return (
      <div className="page module-page">
        <Link to={backTo} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回办事指南</Link>
        <div className="guide-empty-state">
          <span className="guide-empty-icon"><ClipboardList size={29} aria-hidden="true" /></span>
          <h1>这份指南没有找到</h1>
          <p>链接可能已变更，可以返回列表继续搜索其他问题。</p>
          <Link to={backTo} className="button-link">返回办事指南 <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page module-page">
      <div className="page-heading">
        <Link to={backTo} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回{searchParams.get('q')?.trim() ? '搜索结果' : '办事指南'}</Link>
        <p className="eyebrow">校园办事 · {guide.category}</p>
        <h1>{guide.title}</h1>
        <div className="guide-detail-label"><ExampleBadge isExample={guide.isExample} /></div>
      </div>

      {guide.isExample && <ExampleNotice />}

      <section className="guide-answer-panel" aria-labelledby="guide-answer-heading">
        <h2 id="guide-answer-heading">一句话说明</h2>
        <p>{guide.summary}</p>
      </section>

      <div className="guide-detail-grid">
        <div className="guide-detail-main">
          <section className="guide-detail-section" aria-labelledby="guide-steps-heading">
            <h2 id="guide-steps-heading">办理步骤</h2>
            <ol className="guide-step-list" role="list">
              {guide.steps.map((step, index) => (
                <li key={`${guide.id}-step-${index}`}><p>{step}</p></li>
              ))}
            </ol>
          </section>
          <section className="guide-detail-section" aria-labelledby="guide-materials-heading">
            <h2 id="guide-materials-heading">需要的材料</h2>
            {guide.materials.length > 0 ? (
              <ul className="guide-material-list">{guide.materials.map((material, index) => <li key={`${guide.id}-material-${index}`}>{material}</li>)}</ul>
            ) : <p>{unverified}</p>}
          </section>
        </div>

        <aside className="guide-detail-section guide-meta-panel" aria-labelledby="guide-meta-heading">
          <h2 id="guide-meta-heading">办理信息</h2>
          <dl className="guide-meta-list">
            <div><dt>办理地点</dt><dd>{guide.location ?? unverified}</dd></div>
            <div><dt>开放时间</dt><dd>{guide.openingHours ?? unverified}</dd></div>
            <div><dt>联系方式</dt><dd>{guide.contact ?? unverified}</dd></div>
            <div><dt>资料来源</dt><dd>{guide.source ?? unverified}</dd></div>
            <div><dt>最后核验时间</dt><dd>{guide.verifiedAt ?? '待核验'}</dd></div>
          </dl>
        </aside>
      </div>

      <section className="info-panel" aria-labelledby="guide-references-heading">
        <h2 id="guide-references-heading">参考资料</h2>
        {guide.references.length > 0 ? (
          <ul className="guide-reference-list">
            {guide.references.map((reference, index) => (
              <li key={`${guide.id}-reference-${index}`}>
                <a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}<span className="guide-reference-note">（在新标签页打开）</span></a>
              </li>
            ))}
          </ul>
        ) : <p>参考资料待补充，官方来源及链接待核实。</p>}
      </section>

      <Link to={backTo} className="guide-bottom-back"><ArrowLeft size={16} aria-hidden="true" /> 返回{searchParams.get('q')?.trim() ? '搜索结果' : '办事指南'}</Link>
    </div>
  )
}
