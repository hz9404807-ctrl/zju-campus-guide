import { useCallback, useEffect, useState } from 'react'

export function useFoodResource<T>(load: () => Promise<T>, dependency = '') {
  const [request, setRequest] = useState({ attempt: 0, preserve: false })
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string; load: typeof load; dependency: string }>({ data: null, loading: true, error: '', load, dependency })
  const reload = useCallback(() => setRequest((current) => ({ attempt: current.attempt + 1, preserve: false })), [])
  const refresh = useCallback(() => setRequest((current) => ({ attempt: current.attempt + 1, preserve: true })), [])
  useEffect(() => {
    let active = true
    setState((current) => ({ data: request.preserve && current.load === load && current.dependency === dependency ? current.data : null, loading: true, error: '', load, dependency }))
    load().then((data) => { if (active) setState({ data, loading: false, error: '', load, dependency }) }).catch((error) => {
      if (active) setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : '加载失败，请检查网络后重试。' }))
    })
    return () => { active = false }
  }, [load, dependency, request])
  const current = state.load === load && state.dependency === dependency
  return { data: current ? state.data : null, loading: current ? state.loading : true, error: current ? state.error : '', reload, refresh }
}
