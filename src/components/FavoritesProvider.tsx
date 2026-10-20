import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFoodAuth } from '../hooks/useFoodAuth'
import { listFavorites, removeFavorite, saveFavorite } from '../lib/foodService'
import type { Favorite, FavoriteContext, FavoriteKind } from '../types/favorite'

function useFavoritesState() {
  const auth=useFoodAuth()
  const owner=!auth.loading && !auth.error && auth.user?.verifiedCampus ? auth.user.id : ''
  const liveOwner=useRef(owner); liveOwner.current=owner
  const [requested,setRequested]=useState(false)
  const [revision,setRevision]=useState(0)
  const [state,setState]=useState<{owner:string;items:Favorite[];loading:boolean;error:string}>({owner:'',items:[],loading:false,error:''})
  const locks=useRef(new Set<string>())
  const [busy,setBusy]=useState<string[]>([])
  const activate=useCallback(()=>setRequested(true),[])
  const reload=useCallback(()=>setRevision(n=>n+1),[])
  useEffect(()=>{
    if(!owner || !requested){setState({owner:'',items:[],loading:false,error:''});return}
    let active=true
    setState({owner,items:[],loading:true,error:''})
    listFavorites().then(items=>{if(active && liveOwner.current===owner)setState({owner,items,loading:false,error:''})}).catch(error=>{if(active && liveOwner.current===owner)setState({owner,items:[],loading:false,error:error instanceof Error?error.message:'收藏加载失败，请重试。'})})
    return ()=>{active=false}
  },[owner,requested,revision])
  const current=state.owner===owner && !!owner
  async function change(kind:FavoriteKind,id:string,context:FavoriteContext,remove:boolean) {
    const requestOwner=owner
    if(!requestOwner)throw Error('请先使用已验证的浙大邮箱登录。')
    const key=`${requestOwner}:${kind}:${id}`
    if(locks.current.has(key))throw Error('这条收藏正在保存，请稍后再试。')
    locks.current.add(key);setBusy([...locks.current])
    try {
      if(remove)await removeFavorite(kind,id);else await saveFavorite(kind,id,context)
      if(liveOwner.current!==requestOwner)throw Error('登录账号已变化，请在当前账号下重试。')
      // The service has confirmed both the write and unchanged server identity.
      setState(previous=>{
        if(previous.owner!==requestOwner)return previous
        const match=(item:Favorite)=>item.target_kind===kind && item.target_id===id
        const items=remove ? previous.items.filter(item=>!match(item)) : previous.items.some(match) ? previous.items.map(item=>match(item)?{...item,context}:item) : [{target_kind:kind,target_id:id,context,created_at:new Date().toISOString()},...previous.items]
        return {...previous,items}
      })
    } finally {locks.current.delete(key);setBusy([...locks.current])}
  }
  return {owner,activate,reload,items:current?state.items:[],loading:!!owner && requested && (!current || state.loading),error:current?state.error:'',busy:(kind:FavoriteKind,id:string)=>busy.includes(`${owner}:${kind}:${id}`),change}
}
const Context=createContext<ReturnType<typeof useFavoritesState>|null>(null)
export function FavoritesProvider({children}:{children:ReactNode}) { const value=useFavoritesState();return <Context.Provider value={value}>{children}</Context.Provider> }
export function useFavorites(){const value=useContext(Context);if(!value)throw Error('Favorites provider missing');return value}
