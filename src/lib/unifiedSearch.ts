import { findRelatedSources, guideIntentMatches, normalizeSearch, resolveGuideRoute, searchGuides, suggestGuides, websiteSearchDetails } from './campusContent.ts'
import type { CampusAccount, CampusWebsite } from './campusContent.ts'
import type { Guide, ServiceWindow } from '../types/guide.ts'

export function canonicalDestination(value: string) {
  try { const url = new URL(value); if(!/^#!?\//.test(url.hash))url.hash = ''; url.hostname = url.hostname.toLowerCase(); url.pathname = url.pathname.replace(/\/+$/, '') || '/'; url.searchParams.sort(); return url.href }
  catch { return value }
}
export function homeSearchReturn(query: string) { return `/${query ? `?q=${encodeURIComponent(query)}` : ''}#home-search` }
export function safeHomeReturn(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null
  try { const url = new URL(value, 'https://campus-guide.invalid'); return url.origin === 'https://campus-guide.invalid' && url.pathname === '/' ? homeSearchReturn((url.searchParams.get('q') ?? '').slice(0, 200)) : null } catch { return null }
}
export function unifiedSearch(query: string, data: { guides: Guide[]; websites: CampusWebsite[]; accounts: CampusAccount[]; windows: ServiceWindow[] }) {
  const q = normalizeSearch(query).slice(0,200)
  if (!q) return { guides: [], primaryGuideIds: [] as string[], websites: [], accounts: [], suggestions: [], notice: '' }
  const found = searchGuides(data.guides, q, '', data.windows)
  const guides = [...new Map(found.guides.map(g => [g.id,g])).values()]
  const primary=guides.filter(guide=>guideIntentMatches(guide,found.taskQuery))
  const related = findRelatedSources(data.websites,data.accounts,q,primary.length?primary:guides)
  const seen = new Set<string>()
  const websites = related.websites.filter(site => {
    // Official is a provenance claim: keep external directories in the source module.
    if (site.scope !== '学校域名') return false
    const key=canonicalDestination(site.url)
    if (seen.has(key)) return false
    seen.add(key); return true
  }).map(site=>({ ...site, details: websiteSearchDetails(site,guides,q), associated: ![site.name,site.summary].some(text=>normalizeSearch(text).includes(q)) }))
  const accounts = [...new Map(related.accounts.map(account=>[`${normalizeSearch(account.name)}|${normalizeSearch(account.organization??'')}`,account])).values()]
  return {guides,primaryGuideIds:primary.map(g=>g.id),websites,accounts,suggestions: guides.length ? [] : suggestGuides(data.guides,q),notice:found.notice}
}
export function unifiedGuideUrl(guide: Guide, query: string) {
  const params=new URLSearchParams({q:query,returnTo:homeSearchReturn(query)})
  const route=resolveGuideRoute(guide,query)
  if(route)params.set('route',route.id)
  return `/guides/${encodeURIComponent(guide.id)}?${params}`
}
