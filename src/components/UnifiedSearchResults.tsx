import { Link } from 'react-router'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { homeSearchReturn, unifiedGuideUrl, unifiedSearch } from '../lib/unifiedSearch'
import guideData from '../data/guides.json'
import websites from '../data/websites.json'
import accounts from '../data/accounts.json'
import windowData from '../data/service-windows.json'
import type { Guide, ServiceWindow } from '../types/guide'

export default function UnifiedSearchResults({query}:{query:string}) {
  const result=unifiedSearch(query,{guides:guideData as Guide[],websites,accounts,windows:windowData as ServiceWindow[]})
  const count=result.guides.length+result.websites.length+result.accounts.length
  return <div className="unified-results" aria-live="polite">
    <p className="unified-result-count" role="status">{count ? `找到 ${result.guides.length} 条办事指南、${result.websites.length} 个官方入口、${result.accounts.length} 个公众号` : '没有找到匹配内容，请换一个关键词。'}</p>
    {result.notice && <p className="guide-condition-note">{result.notice}</p>}
    {!!result.guides.length && <section aria-label="办事指南搜索结果"><h3>先看办理方法 <span>办事指南</span></h3><ul>{result.guides.slice(0,6).map(guide=><li key={guide.id}><Link to={unifiedGuideUrl(guide,query)}><strong>{guide.title}</strong><p>{guide.summary}</p><span>查看办理步骤 <ArrowRight size={14} aria-hidden="true" /></span></Link></li>)}</ul>{result.guides.length>6 && <Link to={`/guides?q=${encodeURIComponent(query)}`}>查看全部 {result.guides.length} 条指南</Link>}</section>}
    {!!result.websites.length && <section aria-label="官方入口搜索结果"><h3>去对应服务办理 <span>官方入口</span></h3><ul>{result.websites.slice(0,5).map(site=><li key={site.id}><a href={site.url} target="_blank" rel="noopener noreferrer"><strong>{site.details.name} <ExternalLink size={14} aria-hidden="true" /></strong><p>{site.details.summary}</p><span>{site.associated ? '相关指南关联的学校入口' : site.scope} · 在新标签页打开</span></a></li>)}</ul>{result.websites.length>5 && <Link to={`/sources?kind=websites&q=${encodeURIComponent(query)}`}>继续查找相关入口</Link>}</section>}
    {!!result.accounts.length && <section aria-label="公众号搜索结果"><h3>继续查通知与动态 <span>公众号</span></h3><ul>{result.accounts.slice(0,4).map(account=><li key={account.id}><Link to={`/sources/${account.id}?returnTo=${encodeURIComponent(homeSearchReturn(query))}`}><strong>{account.name}</strong><p>{account.summary || account.topic}</p><span>{account.category} · 查看收集截图与主体</span></Link></li>)}</ul>{result.accounts.length>4 && <Link to={`/sources?q=${encodeURIComponent(query)}`}>继续查找相关公众号</Link>}</section>}
    {!count && <><p>本站只检索已整理资料。可以试试“成绩单”“补办校园卡”“VPN”等事项。</p>{!!result.suggestions.length && <div className="unified-suggestions"><p>这些事项可能相关，尚未匹配你的完整问题：</p>{result.suggestions.map(guide=><Link key={guide.id} to={unifiedGuideUrl(guide,query)}>{guide.title}</Link>)}</div>}</>}
  </div>
}
