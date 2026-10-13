import { useEffect, useState } from 'react'
import { currentFoodUser, watchFoodUser } from '../lib/foodService'
import type { FoodUser } from '../lib/foodAuth'
export function useFoodAuth() {
  const [state, setState] = useState<{ user: FoodUser | null; loading: boolean; error: string }>({ user: null, loading: true, error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    currentFoodUser().then((user) => { if (active) setState({ user, loading: false, error: '' }) })
      .catch((error) => { if (active) setState({ user: null, loading: false, error: error instanceof Error ? error.message : '账号加载失败，请重试。' }) })
    return () => { active = false }
  }, [attempt])
  useEffect(() => watchFoodUser(() => setAttempt((n) => n + 1)), [])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
