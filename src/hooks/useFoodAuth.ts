import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { currentFoodUser, watchFoodUser } from '../lib/foodService'
import type { FoodUser } from '../lib/foodAuth'
export interface FoodAuthState { user: FoodUser | null; loading: boolean; error: string; retry(): void }
export const FoodAuthContext = createContext<FoodAuthState | null>(null)
export function useFoodAuthState(): FoodAuthState {
  const [state, setState] = useState<{ user: FoodUser | null; loading: boolean; error: string }>({ user: null, loading: true, error: '' })
  const [attempt, setAttempt] = useState(0)
  const requestVersion = useRef(0)
  const checkUser = useCallback((event?: string, sessionUserId?: string | null) => {
    // Invalidate immediately: an auth event may arrive before React cleans up the old effect.
    requestVersion.current += 1
    setState((current) => {
      // Refreshing an already verified account must not discard its unsaved forms.
      // The event ID only permits keeping existing state; getUser still verifies it.
      const sameVerifiedUser = (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')
        && !current.loading && !current.error && current.user?.verifiedCampus && current.user.id === sessionUserId
      return sameVerifiedUser ? current : { user: null, loading: true, error: '' }
    })
    setAttempt((n) => n + 1)
  }, [])
  const retry = useCallback(() => checkUser(), [checkUser])
  useEffect(() => {
    let active = true
    const version = requestVersion.current
    currentFoodUser().then((user) => { if (active && requestVersion.current === version) setState({ user, loading: false, error: '' }) })
      .catch((error) => { if (active && requestVersion.current === version) setState({ user: null, loading: false, error: error instanceof Error ? error.message : '账号加载失败，请重试。' }) })
    return () => { active = false }
  }, [attempt])
  useEffect(() => watchFoodUser(checkUser), [checkUser])
  return { ...state, retry }
}
export function useFoodAuth(): FoodAuthState {
  const auth = useContext(FoodAuthContext)
  if (!auth) throw new Error('Food account provider is missing.')
  return auth
}
