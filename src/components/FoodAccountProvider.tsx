import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { FoodAuthContext, useFoodAuthState } from '../hooks/useFoodAuth'
import { FoodProfilesContext } from '../hooks/useFoodProfiles'
import { createFoodProfile, isFoodProfilesReady, loadFoodProfiles } from '../lib/foodService'
import { preferredProfile, profileStorageKey } from '../lib/foodProfiles'
import { FavoritesProvider } from './FavoritesProvider'
import type { FoodProfile } from '../lib/foodProfiles'
function storedProfile(userId: string) {
  try { return localStorage.getItem(profileStorageKey(userId)) } catch { return null }
}
function rememberProfile(userId: string, id: string) {
  try { localStorage.setItem(profileStorageKey(userId), id) } catch { /* Selection memory is optional; backend remains canonical. */ }
}
export default function FoodAccountProvider() {
  const auth = useFoodAuthState()
  const owner = isFoodProfilesReady && auth.user?.verifiedCampus ? auth.user.id : ''
  const liveOwner = useRef(owner)
  liveOwner.current = owner
  const [attempt, setAttempt] = useState(0)
  const [creating, setCreating] = useState(false)
  const createLock = useRef(false)
  const [state, setState] = useState<{ owner: string; items: FoodProfile[]; activeId: string; loading: boolean; error: string }>({ owner: '', items: [], activeId: '', loading: false, error: '' })
  useEffect(() => {
    let active = true
    setCreating(false)
    if (!owner) { setState({ owner: '', items: [], activeId: '', loading: false, error: '' }); return }
    setState({ owner, items: [], activeId: '', loading: true, error: '' })
    loadFoodProfiles(owner).then((items) => {
      if (!active) return
      const profile = preferredProfile(items, storedProfile(owner))
      if (!profile) throw new Error('没有可用档案，请重新加载。')
      setState({ owner, items, activeId: profile.id, loading: false, error: '' })
    }).catch((error) => {
      if (active) setState({ owner, items: [], activeId: '', loading: false, error: error instanceof Error ? error.message : '档案加载失败，请重试。' })
    })
    return () => { active = false }
  }, [owner, attempt])
  const current = !!owner && state.owner === owner
  const items = current ? state.items : []
  const profile = current ? items.find((item) => item.id === state.activeId) ?? null : null
  const reload = () => setAttempt((n) => n + 1)
  const profiles = {
    enabled: isFoodProfilesReady && !!auth.user?.verifiedCampus, items, active: profile,
    loading: !!owner && (!current || state.loading), creating, error: current ? state.error : '',
    select(id: string) {
      if (!current || state.loading || creating || !items.some((item) => item.id === id)) return
      rememberProfile(owner, id)
      setState((previous) => previous.owner === owner ? { ...previous, activeId: id } : previous)
    },
    async create(name: string) {
      if (!owner || !current || state.loading || state.error || createLock.current) throw new Error('请等待档案加载完成后再创建。')
      if (items.length >= 5) throw new Error('这个邮箱已使用全部五个档案。')
      createLock.current = true; setCreating(true)
      const requestOwner = owner
      try {
        const id = await createFoodProfile(name, requestOwner)
        if (liveOwner.current !== requestOwner) throw new Error('登录账号已变化，请在当前账号下重新加载。')
        rememberProfile(requestOwner, id)
        reload()
      } finally {
        createLock.current = false
        if (liveOwner.current === requestOwner) setCreating(false)
      }
    },
    reload,
  }
  return <FoodAuthContext.Provider value={auth}><FoodProfilesContext.Provider value={profiles}><FavoritesProvider><Outlet /></FavoritesProvider></FoodProfilesContext.Provider></FoodAuthContext.Provider>
}
