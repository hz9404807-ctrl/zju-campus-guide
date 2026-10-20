import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useFavorites } from './FavoritesProvider'
import { staticFavoriteTarget } from '../lib/favoriteTargets'
import { listFoods } from '../lib/foodService'
import guidesData from '../data/guides.json'
import websites from '../data/websites.json'
import windowsData from '../data/service-windows.json'
import type { Guide, ServiceWindow } from '../types/guide'
import type { Food } from '../types/food'
import type { Favorite } from '../types/favorite'
import './favorites.css'
export default function MyFavorites() {
  const favorites=useFavorites()
  const [foods,setFoods]=useState<{items:Food[];loading:boolean;error:string}>({items:[],loading:false,error:''})
  const [attempt,setAttempt]=useState(0),[error,setError]=useState('')
  const foodIds=favorites.items.filter(item=>item.target_kind==='food').map(item=>item.target_id).sort().join(',')
  useEffect(favorites.activate,[favorites.activate])
  useEffect(()=>{
    let active=true
    if(!foodIds){setFoods({items:[],loading:false,error:''});return}
    setFoods({items:[],loading:true,error:''})
    listFoods().then(items=>{if(active)setFoods({items,loading:false,error:''})}).catch(e=>{if(active)setFoods({items:[],loading:false,error:e instanceof Error?e.message:'美食暂时无法加载。'})})
    return ()=>{active=false}
  },[foodIds,attempt])
  async function remove(item:Favorite) {setError('');try{await favorites.change(item.target_kind,item.target_id,{},true)}catch(e){setError(e instanceof Error?e.message:'移除失败，请重试。')}}
  return <div aria-busy={favorites.loading}>
    {favorites.loading && <p role="status">正在加载我的收藏…</p>}
    {favorites.error && <div role="alert"><p>{favorites.error}</p><button type="button" className="button-link" onClick={favorites.reload}>重试我的收藏</button></div>}
    {error && <p role="alert">{error}</p>}
    {!favorites.loading && !favorites.error && !favorites.items.length && <div className="account-empty"><h3>还没有收藏</h3><p>把常用指南、官方入口和喜欢的美食放在这里，下次方便找到。收藏不记录本次办理进度。</p><Link className="button-link" to="/guides">去看看办事指南</Link></div>}
    <ul className="favorite-list">{favorites.items.map(item=>{
      const food=item.target_kind==='food' ? foods.items.find(food=>food.id===item.target_id && !food.deleted_at && !food.isExample) : null
      const target=item.target_kind==='food' ? food ? {title:food.name,summary:food.location,to:`/food/${encodeURIComponent(food.id)}`,notice:''} : null : staticFavoriteTarget(item,guidesData as Guide[],websites,windowsData as ServiceWindow[])
      const pending=item.target_kind==='food' && foods.loading
      const failed=item.target_kind==='food' && !!foods.error
      return <li key={`${item.target_kind}:${item.target_id}`}><span className="favorite-kind">{item.target_kind==='guide'?'办事指南':item.target_kind==='food'?'美食':'官方入口'}</span>
        <h3>{target ? <Link to={target.to}>{target.title}</Link> : pending ? '正在查找这道美食…' : failed ? '暂时无法确认美食状态' : '原内容已撤下或不再可用'}</h3>
        {target && <><p>{target.summary}</p>{target.notice && <p role="note">{target.notice}</p>}<Link to={target.to}>打开收藏内容</Link></>}
        {!target && !pending && !failed && <p>记录仍然保留，当前无法打开详情。你可以移除收藏。</p>}
        {failed && <p role="alert">{foods.error}<button className="favorite-remove" type="button" onClick={()=>setAttempt(n=>n+1)}>重试美食状态</button></p>}
        <div><button className="favorite-remove" type="button" disabled={favorites.busy(item.target_kind,item.target_id)} onClick={()=>remove(item)}>{favorites.busy(item.target_kind,item.target_id)?'正在移除…':'移除收藏'}</button></div>
      </li>
    })}</ul>
  </div>
}
