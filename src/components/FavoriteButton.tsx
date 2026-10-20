import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Bookmark } from 'lucide-react'
import { useFoodAuth } from '../hooks/useFoodAuth'
import { useFavorites } from './FavoritesProvider'
import type { FavoriteContext, FavoriteKind } from '../types/favorite'
import './favorites.css'
export default function FavoriteButton({kind,id,context={}}:{kind:FavoriteKind;id:string;context?:FavoriteContext}) {
  const auth=useFoodAuth(), favorites=useFavorites(), location=useLocation()
  const [error,setError]=useState(''),[login,setLogin]=useState(false)
  const [contextSaved,setContextSaved]=useState(false)
  const identity=`${favorites.owner}:${kind}:${id}`
  useEffect(()=>{setError('');setLogin(false);setContextSaved(false)},[identity])
  useEffect(favorites.activate,[favorites.activate])
  const item=favorites.items.find(item=>item.target_kind===kind && item.target_id===id)
  const busy=favorites.busy(kind,id)
  const contextChanged=!!item && (item.context.route!==context.route || item.context.campus!==context.campus)
  const returnTo=location.pathname+location.search+location.hash
  async function change(update=false) {
    setError('');setContextSaved(false)
    if(!favorites.owner){setLogin(true);return}
    try{await favorites.change(kind,id,context,!!item && !update);if(update)setContextSaved(true)}catch(e){setError(e instanceof Error?e.message:'收藏没有保存，请重试。')}
  }
  return <div className="favorite-control">
    <button className="favorite-button" type="button" aria-pressed={!!item} disabled={auth.loading || busy || favorites.loading || !!favorites.error} onClick={()=>change()}><Bookmark size={16} fill={item?'currentColor':'none'} aria-hidden="true" />{busy?'正在保存…':item?'已收藏，点击取消':'收藏'}</button>
    {contextChanged && <button className="favorite-context-update" type="button" disabled={busy} onClick={()=>change(true)}>更新收藏的办理位置</button>}
    {contextSaved && <span role="status">收藏位置已更新</span>}
    {favorites.loading && <span role="status">正在读取收藏状态…</span>}
    {favorites.error && <div role="alert"><span>{favorites.error}</span><button type="button" onClick={favorites.reload}>重试收藏</button></div>}
    {error && <p role="alert">{error}</p>}
    {login && <p role="status">浏览仍然免费开放。<Link to={`/food/login?returnTo=${encodeURIComponent(returnTo)}`}>登录浙大邮箱后收藏，完成后返回这里</Link></p>}
  </div>
}
