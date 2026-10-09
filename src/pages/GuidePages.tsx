import { useEffect } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, ClipboardList, ExternalLink, Search } from 'lucide-react'
import SearchField from '../components/SearchField'
import SearchHighlight from '../components/SearchHighlight'
import ResultPager from '../components/ResultPager'
import GuideStepActions from '../components/GuideStepActions'
import GuideServiceWindows from '../components/GuideServiceWindows'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { filterGuides, findRelatedSources, guideSearchMatch, guideRouteView, resolveGuideRoute, primaryGuideAction, sourceSearchUrl, suggestGuides, websiteSearchDetails } from '../lib/campusContent'
import guideData from '../data/guides.json'
import accountData from '../data/accounts.json'
import websiteData from '../data/websites.json'
import serviceWindowData from '../data/service-windows.json'
import type { Guide, ServiceWindow } from '../types/guide'
import './guides.css'

const guides = guideData as Guide[]
const serviceWindows = serviceWindowData as ServiceWindow[]
const categories = [...new Set(guides.map((guide) => guide.category))]
const quickKeywords = ['校园卡', '场地', '选课', '报修', 'VPN', '志愿', '校历']
const pageSize = 24

export function GuidePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const debouncedQuery = useDebouncedValue(query, 200)
  const results = filterGuides(guides, debouncedQuery, category, serviceWindows)
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), Math.max(1, Math.ceil(results.length / pageSize)))
  const updating = query !== debouncedQuery
  const sources = findRelatedSources(websiteData, accountData, debouncedQuery, results, category)
  const suggestions = !results.length ? suggestGuides(guides, debouncedQuery, category) : []
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
    <section className="guide-search-panel" role="search" aria-label="查找校园办事指南">
      <SearchField id="guide-search" label="你想办什么事？" placeholder="例如：校园卡丢了、图书馆预约、寝室报修" value={query} onChange={(value) => update('q', value)} hint="可以直接输入问题，如“寝室灯坏了”；支持近义词、地点、时间和电话，匹配标题的指南优先，并展示相关网站和公众号。" />
      <div className="content-filter-row"><label htmlFor="guide-category">按类别查找</label><select id="guide-category" value={category} onChange={(event) => update('category', event.target.value)}><option value="">全部类别（{guides.length}）</option>{categories.map((item) => <option key={item} value={item}>{item}（{guides.filter((guide) => guide.category === item).length}）</option>)}</select></div>
      <div className="guide-quick-search"><span>常见需求</span>{quickKeywords.map((keyword) => <button key={keyword} type="button" className="guide-keyword-button" onClick={() => update('q', keyword)}>{keyword}</button>)}</div>
    </section>
    <section aria-labelledby="guide-results-heading" aria-busy={updating}>
      <div className="guide-results-heading"><h2 id="guide-results-heading">{query || category ? '查找结果' : '办事问题'}</h2><p role="status" aria-live="polite">{updating ? '正在更新结果…' : `找到 ${results.length} 条指南`}</p></div>
      {results.length ? <>
        <ul className="guide-result-grid" role="list">{results.slice((page - 1) * pageSize, page * pageSize).map((guide) => { const route = resolveGuideRoute(guide, debouncedQuery); const view = guideRouteView(guide, route); const match = guideSearchMatch(view, debouncedQuery, serviceWindows); const action = primaryGuideAction(guide, debouncedQuery); const cardParams = new URLSearchParams(params); cardParams.delete('route'); if (route) cardParams.set('route', route.id); const cardSearch = cardParams.size ? `?${cardParams.toString()}` : ''; return <li key={guide.id}><article className="guide-result-card">
          <div className="guide-card-labels"><span className="guide-category">{guide.category}</span></div>
          <h3><Link to={`/guides/${guide.id}${cardSearch}`} className="guide-card-title">{guide.title}</Link></h3><p className="guide-card-summary">{view.summary}</p>
          {match && <Link className="guide-match-link" to={`/guides/${guide.id}${cardSearch}#${match.anchor}`}><span>{match.label}</span><SearchHighlight text={match.text} query={debouncedQuery} /><span className="guide-match-go">定位这段内容 <ArrowRight size={14} aria-hidden="true" /></span></Link>}
          <div className="guide-card-footer"><Link to={`/guides/${guide.id}${cardSearch}`} className="guide-card-action">{guide.routes?.length && !route ? guide.routeChoiceLabel : '查看办理方法'} <ArrowRight size={17} aria-hidden="true" /></Link>{action && <a href={action.url} target="_blank" rel="noopener noreferrer" className="guide-card-reference">{action.label} <ExternalLink size={14} aria-hidden="true" /></a>}</div>
        </article></li> })}</ul>
        <ResultPager page={page} total={results.length} pageSize={pageSize} onChange={(value) => update('page', String(value))} />
      </> : <div className="guide-empty-state"><Search size={27} aria-hidden="true" /><h3>没有找到相关指南</h3><p>可以换一种说法，或带着当前问题继续查找网站和公众号。</p>{category && <button type="button" className="button-link" onClick={() => update('category', '')}>仅取消类别筛选</button>}{suggestions.length > 0 && <div className="guide-suggestions"><p>可能相关的事项（并非准确匹配）：</p>{suggestions.map((guide) => <Link key={guide.id} to={`/guides/${guide.id}${detailSearch}`}>{guide.title}<ArrowRight size={15} aria-hidden="true" /></Link>)}</div>}<div className="guide-entry-links"><Link to={sourceSearchUrl(query, 'websites')}>继续查网站 <ArrowRight size={16} aria-hidden="true" /></Link><Link to={sourceSearchUrl(query, 'accounts')}>继续查公众号 <ArrowRight size={16} aria-hidden="true" /></Link></div><button type="button" className="guide-reset-button" onClick={() => setParams({}, { replace: true })}>清除筛选，查看全部指南</button></div>}
    </section>
    {debouncedQuery.trim() && (sources.websites.length > 0 || sources.accounts.length > 0) && <section className="guide-search-sources" aria-label="相关网站与公众号" aria-busy={updating}>
      <h2>相关网站与公众号</h2><p className="guide-source-hint">与问题匹配的信息源，以及前几条指南关联的入口。</p>
      {sources.websites.length > 0 && <div className="guide-source-group"><h3>网站入口</h3><ul>{sources.websites.slice(0, 3).map((site) => <li key={site.id}><a href={site.url} target="_blank" rel="noopener noreferrer">{websiteSearchDetails(site, results).name}<ExternalLink size={15} aria-hidden="true" /></a><span>{site.scope}</span></li>)}</ul><Link to={sourceSearchUrl(query, 'websites')} className="guide-bottom-back">继续查网站 <ArrowRight size={16} aria-hidden="true" /></Link></div>}
      {sources.accounts.length > 0 && <div className="guide-source-group"><h3>微信公众号</h3><ul>{sources.accounts.slice(0, 3).map((account) => <li key={account.id}><Link to={`/sources/${account.id}?q=${encodeURIComponent(query)}`}>{account.name}<ArrowRight size={15} aria-hidden="true" /></Link><span>{account.topic}</span></li>)}</ul><Link to={sourceSearchUrl(query, 'accounts')} className="guide-bottom-back">继续查公众号 <ArrowRight size={16} aria-hidden="true" /></Link></div>}
    </section>}
  </div>
}

export function GuideDetailPage() {
  const { guideId } = useParams()
  const location = useLocation()
  useEffect(() => {
    if (!/^#guide-(step|help|material)-\d+$|^#guide-windows-heading$/.test(location.hash)) return
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(location.hash.slice(1))
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.search, location.hash])
  const [params, setParams] = useSearchParams()
  const originalGuide = guides.find((item) => item.id === guideId || item.aliases?.includes(guideId ?? ''))
  const query = params.get('q') ?? ''
  const route = originalGuide ? resolveGuideRoute(originalGuide, query, params.get('route')) : undefined
  const guide = originalGuide ? guideRouteView(originalGuide, route) : undefined
  const match = guide ? guideSearchMatch(guide, query, serviceWindows) : undefined
  const highlight = (text: string, anchor: string) => match?.anchor === anchor ? <SearchHighlight text={text} query={query} /> : text
  const listParams = new URLSearchParams(params)
  listParams.delete('route')
  const listSearch = listParams.size ? `?${listParams.toString()}` : ''
  const backTo = `/guides${listSearch}`
  function chooseRoute(id: string) {
    const next = new URLSearchParams(params)
    next.set('route', id)
    // Drop a passage anchor because each route has its own step sequence.
    setParams(next)
  }
  if (!guide) return <div className="page module-page"><Link to={backTo} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回办事指南</Link><div className="guide-empty-state"><ClipboardList size={29} aria-hidden="true" /><h1>这份指南没有找到</h1><p>返回列表继续搜索其他问题。</p><Link to={backTo} className="button-link">返回办事指南</Link></div></div>
  const related = accountData.filter((account) => guide.relatedSourceIds.includes(account.id))
  const relatedGuides = guides.filter((item) => guide.relatedGuideIds?.includes(item.id))
  const windows = serviceWindows.filter((window) => guide.serviceWindowIds?.includes(window.id))
  const hasServiceInfo = windows.length > 0 || Boolean(guide.location || guide.openingHours || guide.contact)
  const mainHeading = guide.kind === 'options' ? '选择一种充值方式' : guide.kind === 'procedure' ? '具体操作' : guide.kind === 'resource' ? '如何使用这个入口' : '具体说明'
  return <div className="page module-page">
    <div className="page-heading"><Link to={backTo} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回{params.get('q') ? '搜索结果' : '办事指南'}</Link><p className="eyebrow">校园办事 · {guide.category}</p><h1>{guide.title}</h1></div>
    <section className="guide-answer-panel" aria-labelledby="guide-answer-heading"><h2 id="guide-answer-heading">{['procedure', 'options'].includes(guide.kind) ? '整体流程' : '事项概览'}</h2><p>{guide.summary}</p></section>
    {guide.routes && <section className="guide-route-panel" aria-labelledby="guide-route-heading"><h2 id="guide-route-heading">{guide.routeChoiceLabel}</h2><div className="guide-route-choices"><button type="button" aria-pressed={!route} onClick={() => chooseRoute('all')}>查看完整流程</button>{guide.routes.map((option) => <button key={option.id} type="button" aria-pressed={route?.id === option.id} onClick={() => chooseRoute(option.id)}>{option.label}</button>)}</div><p>{route ? `当前显示：${route.label}。可切换其他办理需求。` : '选择与你的需求相符的方式，查看对应的准备材料、操作和入口。'}</p></section>}
    {match && <p className="guide-search-location"><a href={`#${match.anchor}`}>定位与“{query}”匹配的段落 <ArrowRight size={15} aria-hidden="true" /></a></p>}
    <div className={`guide-detail-grid${hasServiceInfo ? ' has-service-info' : ''}`}><div className="guide-detail-main">
      {guide.materials.length > 0 && <section className="guide-detail-section"><h2>办理前准备</h2><ul className="guide-material-list">{guide.materials.map((material, i) => <li key={i} id={`guide-material-${i}`} tabIndex={-1}>{highlight(material, `guide-material-${i}`)}</li>)}</ul></section>}
      <section className="guide-detail-section"><h2>{mainHeading}</h2>{guide.kind === 'procedure' ? <ol className="guide-step-list">{guide.steps.map((step, i) => <li key={i} id={`guide-step-${i}`} tabIndex={-1}><p>{highlight(step, `guide-step-${i}`)}</p><GuideStepActions actions={(guide.stepActions ?? []).filter((action) => action.stepIndex === i)} /></li>)}</ol> : guide.kind === 'options' ? <ul className="guide-option-list">{guide.steps.map((step, i) => <li key={i} id={`guide-step-${i}`} tabIndex={-1}><p>{highlight(step, `guide-step-${i}`)}</p><GuideStepActions actions={(guide.stepActions ?? []).filter((action) => action.stepIndex === i)} /></li>)}</ul> : <div className="guide-explanation">{guide.steps.map((step, i) => <div key={i} id={`guide-step-${i}`} tabIndex={-1}><p>{highlight(step, `guide-step-${i}`)}</p><GuideStepActions actions={(guide.stepActions ?? []).filter((action) => action.stepIndex === i)} /></div>)}</div>}{guide.completionNote && <p className="guide-completion-note">{guide.completionNote}</p>}</section>
      {guide.troubleshooting && guide.troubleshooting.length > 0 && <section className="guide-detail-section guide-notes"><h2>遇到问题怎么办</h2><ul className="guide-material-list">{guide.troubleshooting.map((note, i) => <li key={i} id={`guide-help-${i}`} tabIndex={-1}>{highlight(note, `guide-help-${i}`)}</li>)}</ul></section>}
      {guide.notes.length > 0 && <section className="guide-detail-section guide-notes"><h2>办理前留意</h2><ul className="guide-material-list">{guide.notes.map((note, i) => <li key={i}>{note}</li>)}</ul></section>}
      {relatedGuides.length > 0 && <section className="guide-detail-section"><h2>相关办理</h2><div className="guide-related-accounts">{relatedGuides.map((item) => <Link key={item.id} to={`/guides/${item.id}${listSearch}`}>{item.title}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>}
    </div>
      {windows.length > 0 ? <GuideServiceWindows key={guide.id} windows={windows} allCampuses={serviceWindows.map((window) => window.campus)} /> : hasServiceInfo && <aside className="guide-detail-section"><h2>办理地点与时间</h2><dl className="guide-meta-list">
        {guide.location && <div><dt>办理地点</dt><dd>{guide.location}</dd></div>}{guide.openingHours && <div><dt>开放时间</dt><dd>{guide.openingHours}</dd></div>}{guide.contact && <div><dt>联系方式</dt><dd>{guide.contact}</dd></div>}
      </dl></aside>}
    </div>
    {guide.references.length > 0 && <section className="info-panel"><h2>{guide.category === '校园卡' ? '官方办事参考' : '办事入口与参考'}</h2><ul className="guide-reference-list">{guide.references.map((reference, i) => <li key={i}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}</a></li>)}</ul></section>}
    {related.length > 0 && <section className="info-panel"><h2>相关公众号</h2><p>可从这些信息源继续查看通知。</p><div className="guide-related-accounts">{related.map((account) => <Link key={account.id} to={`/sources/${account.id}`}>{account.name}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>}
    <Link to={backTo} className="guide-bottom-back"><ArrowLeft size={16} aria-hidden="true" /> 返回{params.get('q') ? '搜索结果' : '办事指南'}</Link>
  </div>
}
