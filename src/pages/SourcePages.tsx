import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Info, Search } from 'lucide-react'
import SearchField from '../components/SearchField'
import ResultPager from '../components/ResultPager'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { filterAccounts, filterWebsites } from '../lib/campusContent'
import accountData from '../data/accounts.json'
import websiteData from '../data/websites.json'
import guideData from '../data/guides.json'
import type { Guide } from '../types/guide'
import './sources.css'

const guides = guideData as Guide[]
const pageSize = 12

export function SourcesPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const websites = params.get('kind') === 'websites'
  const debounced = useDebouncedValue(query, 200)
  const data = websites ? websiteData : accountData
  const categories = [...new Set(data.map((item) => item.category))]
  const accounts = filterAccounts(accountData, debounced, category)
  const sites = filterWebsites(websiteData, debounced, category, guides)
  const total = websites ? sites.length : accounts.length
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), Math.max(1, Math.ceil(total / pageSize)))
  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    if (key === 'kind') next.delete('category')
    setParams(next, { replace: true })
  }
  const detailSearch = params.toString() ? `?${params.toString()}` : ''
  return <div className="page module-page">
    <div className="page-heading"><Link to="/" className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回首页</Link><p className="eyebrow">知道去哪里看，也知道是谁在发布</p><h1>校园信息源导航</h1><p className="page-description">{accountData.length}个公众号与常用网站，按主题查找，保留简介、机构信息和收集截图。</p></div>
    <aside className="content-source-note"><Info size={18} aria-hidden="true" /><p>公众号信息来自小组截图与整理清单；机构和认证仅代表截图所示，不代表本站认证。学校域名与校外网站分别标识。</p></aside>
    <section className="guide-search-panel" role="search" aria-label="查找校园信息源">
      <div className="source-tabs" aria-label="信息源类型"><button type="button" aria-pressed={!websites} onClick={() => update('kind', '')}>微信公众号 <span>{accountData.length}</span></button><button type="button" aria-pressed={websites} onClick={() => update('kind', 'websites')}>常用网站 <span>{websiteData.length}</span></button></div>
      <SearchField id="source-search" label={websites ? '你需要哪个服务入口？' : '你想找哪类信息？'} placeholder={websites ? '例如：校历、邮箱、图书馆、云盘' : '例如：志愿、就业、微积分、美食、心理'} value={query} onChange={(value) => update('q', value)} hint={websites ? '按问题、服务名称、类别、说明或网址搜索，也会查找相关指南的入口。' : '按公众号名称、主题、简介或截图中的机构搜索。'} />
      <div className="content-filter-row"><label htmlFor="source-category">按类别查找</label><select id="source-category" value={category} onChange={(event) => update('category', event.target.value)}><option value="">全部类别</option>{categories.map((item) => <option key={item} value={item}>{item}（{data.filter((entry) => entry.category === item).length}）</option>)}</select></div>
    </section>
    <section aria-labelledby="source-results-heading" aria-busy={query !== debounced}>
      <div className="guide-results-heading"><h2 id="source-results-heading">{websites ? '服务与网站入口' : '微信公众号'}</h2><p role="status" aria-live="polite">{query !== debounced ? '正在更新结果…' : `找到 ${total} 个信息源`}</p></div>
      {total ? <>
        {websites ? <ul className="website-grid">{sites.slice((page - 1) * pageSize, page * pageSize).map((site) => <li key={site.id} className="website-card"><div className="guide-card-labels"><span className="guide-category">{site.category}</span><span className="source-scope">{site.scope}</span></div><h3>{site.name}</h3><p>{site.summary}</p><a className="website-entry" href={site.url} target="_blank" rel="noopener noreferrer">打开网站 <ExternalLink size={16} aria-hidden="true" /></a><span className="website-address">{site.url}</span><Link className="website-guide-link" to={`/guides/${site.guideIds[0]}${detailSearch}`}>查看办理步骤 <ArrowRight size={15} aria-hidden="true" /></Link></li>)}</ul> :
        <ul className="account-grid">{accounts.slice((page - 1) * pageSize, page * pageSize).map((account) => <li key={account.id}><Link to={`/sources/${account.id}${detailSearch}`} className="account-card"><div className="account-preview"><img src={account.image} alt={`${account.name}公众号的收集截图`} loading="lazy" /></div><div className="account-card-body"><div className="guide-card-labels"><span className="guide-category">{account.category}</span></div><h3>{account.name}</h3><span className="account-topic">{account.topic}</span>{account.organization && <p className="account-organization">截图机构：{account.organization}</p>}{account.summary && <p className="account-summary">{account.summary}</p>}<span className="account-details-link">查看截图与备注 <ArrowRight size={16} aria-hidden="true" /></span></div></Link></li>)}</ul>}
        <ResultPager page={page} total={total} pageSize={pageSize} onChange={(value) => update('page', String(value))} />
      </> : <div className="guide-empty-state"><Search size={27} aria-hidden="true" /><h3>没有找到相关信息源</h3><p>试试缩短关键词，或取消类别筛选。</p><button className="button-link" type="button" onClick={() => setParams(websites ? { kind: 'websites' } : {}, { replace: true })}>清除筛选，查看全部</button></div>}
    </section>
  </div>
}

export function SourceDetailPage() {
  const { sourceId } = useParams()
  const [params] = useSearchParams()
  const [copyStatus, setCopyStatus] = useState('')
  const account = accountData.find((item) => item.id === sourceId)
  const backTo = `/sources${params.toString() ? `?${params.toString()}` : ''}`
  if (!account) return <div className="page module-page"><div className="guide-empty-state"><h1>没有找到这个信息源</h1><Link to={backTo} className="button-link">返回信息源导航</Link></div></div>
  const related = guides.filter((guide) => guide.relatedSourceIds.includes(account.id))
  async function copyName() {
    try { await navigator.clipboard.writeText(account!.name); setCopyStatus('名称已复制，可在微信中搜索') }
    catch { setCopyStatus('复制未完成，可以选中上方名称手动复制') }
  }
  return <div className="page module-page">
    <div className="page-heading"><Link to={backTo} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回信息源列表</Link><p className="eyebrow">{account.category} · {account.topic}</p><h1>{account.name}</h1><p className="page-description">按收集截图查看账号信息，在微信中搜索公众号名称。</p></div>
    <div className="source-detail-grid"><section className="source-detail-copy"><h2>这个账号提供什么？</h2>{account.summary && <p className="source-description">{account.summary}</p>}{account.organization && <dl className="guide-meta-list"><div><dt>截图中的机构 / 认证信息</dt><dd>{account.organization}</dd></div></dl>}<div className="source-copy-actions"><button type="button" className="button-link" onClick={copyName}><Copy size={16} aria-hidden="true" /> 复制公众号名称</button><p role="status" aria-live="polite">{copyStatus}</p></div><p className="source-wechat-hint">资料未提供公众号跳转链接或关注二维码，请在微信“搜一搜”中查找，并核对账号主体。</p>{account.notes && <aside className="source-notes"><h3>收集备注</h3><p>{account.notes}</p></aside>}<dl className="guide-meta-list"><div><dt>资料来源</dt><dd>{account.source}</dd></div><div><dt>整理时间</dt><dd>{account.importedAt}（不是账号更新时间）</dd></div></dl></section><figure className="source-original"><a href={account.image} target="_blank" rel="noopener noreferrer" aria-label={`在新标签页查看${account.name}完整截图`}><img src={account.image} alt={`${account.name}公众号原始收集截图`} /></a><figcaption>小组收集截图 · 点击查看原图</figcaption></figure></div>
    {related.length > 0 && <section className="info-panel"><h2>相关办事指南</h2><div className="guide-related-accounts">{related.map((guide) => <Link key={guide.id} to={`/guides/${guide.id}`}>{guide.title}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>}
    <Link to={backTo} className="guide-bottom-back"><ArrowLeft size={16} aria-hidden="true" /> 返回信息源列表</Link>
  </div>
}
