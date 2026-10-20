import type { Favorite, FavoriteContext } from '../types/favorite.ts'
import type { Guide, ServiceWindow } from '../types/guide.ts'
import type { CampusWebsite } from './campusContent.ts'

export function guideFavoriteContext(guide:Guide,params:URLSearchParams,windows:ServiceWindow[]):FavoriteContext {
  const route=guide.routes?.find(route=>route.id===params.get('route'))
  const windowIds=route?.serviceWindowIds ?? guide.serviceWindowIds ?? []
  const allowed=[...new Set([...windows.filter(w=>windowIds.includes(w.id)).map(w=>w.campus),...(route?.stepActions ?? guide.stepActions ?? []).flatMap(a=>'campus'in a && a.campus?[a.campus]:[])])]
  const explicit=params.get('campus')
  const matches=allowed.filter(campus=>(params.get('q')??'').includes(campus))
  const campus=explicit && allowed.includes(explicit)?explicit:matches.length===1?matches[0]:undefined
  return {...(route?{route:route.id}:{}),...(campus?{campus}:{})}
}
export function staticFavoriteTarget(item:Favorite,guides:Guide[],websites:CampusWebsite[],windows:ServiceWindow[]) {
  if(item.target_kind==='guide') {
    const guide=guides.find(g=>g.id===item.target_id || g.aliases?.includes(item.target_id))
    if(!guide)return null
    const params=new URLSearchParams()
    if(item.context.route)params.set('route',item.context.route)
    if(item.context.campus)params.set('campus',item.context.campus)
    const context=guideFavoriteContext(guide,params,windows)
    const next=new URLSearchParams(context as Record<string,string>)
    return {title:guide.title,summary:guide.summary,to:`/guides/${encodeURIComponent(guide.id)}${next.size?`?${next}`:''}`,notice:context.route!==item.context.route || context.campus!==item.context.campus?'原办理位置已调整，将打开当前有效指南。':''}
  }
  if(item.target_kind==='website') {
    const site=websites.find(s=>s.id===item.target_id && s.scope==='学校域名')
    return site ? {title:site.name,summary:site.summary,to:`/sites/${encodeURIComponent(site.id)}`,notice:''} : null
  }
  return null
}
