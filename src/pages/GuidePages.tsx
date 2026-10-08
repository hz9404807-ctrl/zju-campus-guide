import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, ClipboardList, Info, Search, ExternalLink } from 'lucide-react'
import SearchField from '../components/SearchField'
import ResultPager from '../components/ResultPager'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { filterGuides } from '../lib/campusContent'
import guideData from '../data/guides.json'
import accountData from '../data/accounts.json'
import type { Guide } from '../types/guide'
import './guides.css'

const guides: Guide[] = guideData
const categories = [...new Set(guides.map((guide) => guide.category))]
const quickKeywords = ['校园卡', '场地', '选课', '报修', 'VPN', '志愿', '校历']
const pageSize = 24

function VerificationBadge({ guide }: { guide: Guide }) {
  return <span className={`guide-data-badge${guide.verifiedAt ? ' checked' : ''}`}>{guide.verifiedAt ? '部分信息已官网核对' : '小组资料整理'}</span>
}

export function GuidePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const debouncedQuery = useDebouncedValue(query, 200)
  const results = filterGuides(guides, debouncedQuery, category)
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), Math.max(1, Math.ceil(results.length / pageSize)))
  const updating = query !== debouncedQuery
  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const detailSearch = params.toString() ? `?${params.toString()}` : ''
  return <div className="page module-page">
    <div className="page-heading">
      <Link to="/" className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回首页</Link>
      <p className="eyebrow">把分散的入口，整理成清楚的答案</p>
      <h1>校园办事指南</h1>
      <p className="page-description">校园卡、选课、预约、报修和校园服务，从你遇到的问题开始查找。</p>
    </div>
    <aside className="content-source-note"><Info size={18} aria-hidden="true" /><p>已整理小组采集的110条问题，合并整理并补充为{guides.length}份指南。办理规则可能更新，请查看每条指南的来源和核对范围。</p></aside>
    <section className="guide-search-panel" role="search" aria-label="查找校园办事指南">
      <SearchField id="guide-search" label="你想办什么事？" placeholder="例如：校园卡丢了、图书馆预约、寝室报修" value={query} onChange={(value) => update('q', value)} hint="支持搜索问题、答案中的地点、服务入口和关键词；多个关键词用空格分隔。" />
      <div className="content-filter-row"><label htmlFor="guide-category">按类别查找</label><select id="guide-category" value={category} onChange={(event) => update('category', event.target.value)}><option value="">全部类别（{guides.length}）</option>{categories.map((item) => <option key={item} value={item}>{item}（{guides.filter((guide) => guide.category === item).length}）</option>)}</select></div>
      <div className="guide-quick-search"><span>常见需求</span>{quickKeywords.map((keyword) => <button key={keyword} type="button" className="guide-keyword-button" onClick={() => update('q', keyword)}>{keyword}</button>)}</div>
    </section>
    <section aria-labelledby="guide-results-heading" aria-busy={updating}>
      <div className="guide-results-heading"><h2 id="guide-results-heading">{query || category ? '查找结果' : '办事问题'}</h2><p role="status" aria-live="polite">{updating ? '正在更新结果…' : `找到 ${results.length} 条指南`}</p></div>
      {results.length ? <>
        <ul className="guide-result-grid" role="list">{results.slice((page - 1) * pageSize, page * pageSize).map((guide) => <li key={guide.id}><Link to={`/guides/${guide.id}${detailSearch}`} className="guide-result-card">
          <div className="guide-card-labels"><span className="guide-category">{guide.category}</span><VerificationBadge guide={guide} /></div>
          <h3>{guide.title}</h3><p className="guide-card-summary">{guide.summary}</p>
          <div className="guide-card-footer"><span>{guide.verifiedAt ? `官网核对：${guide.verifiedAt}` : `资料整理：${guide.importedAt}`}</span><span className="guide-card-action">查看答案 <ArrowRight size={17} aria-hidden="true" /></span></div>
        </Link></li>)}</ul>
        <ResultPager page={page} total={results.length} pageSize={pageSize} onChange={(value) => update('page', String(value))} />
      </> : <div className="guide-empty-state"><Search size={27} aria-hidden="true" /><h3>没有找到相关指南</h3><p>可以缩短关键词或切换到全部类别，也可以到信息源导航查找相关公众号。</p><button type="button" className="button-link" onClick={() => setParams({}, { replace: true })}>清除筛选，查看全部</button><Link to="/sources" className="guide-bottom-back">去信息源导航 <ArrowRight size={16} aria-hidden="true" /></Link></div>}
    </section>
  </div>
}

export function GuideDetailPage() {
  const { guideId } = useParams()
  const [params] = useSearchParams()
  const guide = guides.find((item) => item.id === guideId || item.aliases?.includes(guideId ?? ''))
  const backTo = `/guides${params.toString() ? `?${params.toString()}` : ''}`
  if (!guide) return <div className="page module-page"><Link to={backTo} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回办事指南</Link><div className="guide-empty-state"><ClipboardList size={29} aria-hidden="true" /><h1>这份指南没有找到</h1><p>返回列表继续搜索其他问题。</p><Link to={backTo} className="button-link">返回办事指南</Link></div></div>
  const related = accountData.filter((account) => guide.relatedSourceIds.includes(account.id))
  const mainHeading = guide.kind === 'procedure' ? '办理方法' : guide.kind === 'resource' ? '如何使用这个入口' : '具体说明'
  return <div className="page module-page">
    <div className="page-heading"><Link to={backTo} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回{params.get('q') ? '搜索结果' : '办事指南'}</Link><p className="eyebrow">校园办事 · {guide.category}</p><h1>{guide.title}</h1><div className="guide-detail-label"><VerificationBadge guide={guide} /></div></div>
    <section className="guide-answer-panel" aria-labelledby="guide-answer-heading"><h2 id="guide-answer-heading">先看这里</h2><p>{guide.summary}</p>
      {guide.references.length > 0 && <div className="guide-entry-links">{guide.references.slice(0, 3).map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label.replace('（小组资料提供）', '')}<ExternalLink size={15} aria-hidden="true" /></a>)}</div>}
    </section>
    <div className="guide-detail-grid"><div className="guide-detail-main">
      <section className="guide-detail-section"><h2>{mainHeading}</h2>{guide.kind === 'procedure' ? <ol className="guide-step-list">{guide.steps.map((step, i) => <li key={i}><p>{step}</p></li>)}</ol> : <div className="guide-explanation">{guide.steps.map((step, i) => <p key={i}>{step}</p>)}</div>}</section>
      {guide.materials.length > 0 && <section className="guide-detail-section"><h2>需要的材料</h2><ul className="guide-material-list">{guide.materials.map((material, i) => <li key={i}>{material}</li>)}</ul></section>}
      {guide.notes.length > 0 && <section className="guide-detail-section guide-notes"><h2>办理前留意</h2><ul className="guide-material-list">{guide.notes.map((note, i) => <li key={i}>{note}</li>)}</ul></section>}
    </div><aside className="guide-detail-section guide-meta-panel"><h2>来源与办理信息</h2><dl className="guide-meta-list">
      {guide.location && <div><dt>办理地点</dt><dd>{guide.location}</dd></div>}{guide.openingHours && <div><dt>开放时间</dt><dd>{guide.openingHours}</dd></div>}{guide.contact && <div><dt>联系方式</dt><dd>{guide.contact}</dd></div>}
      <div><dt>原始资料</dt><dd>{guide.source}</dd></div><div><dt>整理时间</dt><dd>{guide.importedAt}</dd></div><div><dt>官网核对</dt><dd>{guide.verifiedAt ? `${guide.verifiedAt} · ${guide.verificationScope}` : '尚未逐项核对当前办理规则。'}</dd></div>
    </dl><p className="guide-meta-hint">未列出的材料、时间和联系方式，原始资料未提供或尚未核对；请以服务入口最新要求为准。</p></aside></div>
    {guide.references.length > 0 && <section className="info-panel"><h2>服务入口与参考资料</h2><ul className="guide-reference-list">{guide.references.map((reference, i) => <li key={i}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}<span className="guide-reference-note">（新标签页）</span></a></li>)}</ul></section>}
    {related.length > 0 && <section className="info-panel"><h2>相关公众号</h2><p>可从这些信息源继续查看通知；下列账号的身份和简介以收集截图为准。</p><div className="guide-related-accounts">{related.map((account) => <Link key={account.id} to={`/sources/${account.id}`}>{account.name}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>}
    <Link to={backTo} className="guide-bottom-back"><ArrowLeft size={16} aria-hidden="true" /> 返回{params.get('q') ? '搜索结果' : '办事指南'}</Link>
  </div>
}
