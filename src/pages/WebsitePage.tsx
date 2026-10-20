import { Link, useParams } from 'react-router'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import websites from '../data/websites.json'
import FavoriteButton from '../components/FavoriteButton'
export default function WebsitePage() {
  const {websiteId}=useParams()
  const site=websites.find(site=>site.id===websiteId && site.scope==='学校域名')
  return <div className="page module-page"><Link className="breadcrumb" to="/sources?kind=websites"><ArrowLeft size={16} aria-hidden="true" />返回网站目录</Link>{site ? <article className="about-card"><p className="eyebrow">目录中的官方入口</p><h1>{site.name}</h1><p className="page-description">{site.summary}</p><FavoriteButton kind="website" id={site.id} /><a className="button-link" href={site.url} target="_blank" rel="noopener noreferrer">打开当前官方网站 <ExternalLink size={16} aria-hidden="true" /></a><p className="page-description">学校入口可能需要统一身份认证，最新办理规则以对应官网为准。</p></article> : <section className="module-empty"><h1>这个官方入口暂时不可用</h1><p>目录可能已经更新，可返回网站目录继续查找。</p></section>}</div>
}
