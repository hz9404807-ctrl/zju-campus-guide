const sourceListKeys = ['kind', 'q', 'category', 'page'] as const
const guideListKeys = ['q', 'category', 'page'] as const
const localOrigin = 'https://campus-guide.invalid'

function pickParams(params: URLSearchParams, keys: readonly string[]) {
  const next = new URLSearchParams()
  for (const key of keys) {
    const value = params.get(key)
    if (value) next.set(key, value)
  }
  return next
}

function searchSuffix(params: URLSearchParams) {
  return params.size ? `?${params.toString()}` : ''
}

function sourceListUrl(params: URLSearchParams) {
  return `/sources${searchSuffix(pickParams(params, sourceListKeys))}`
}

function safeSourceReturn(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const url = new URL(value, localOrigin)
    if (url.origin !== localOrigin || url.pathname !== '/sources') return null
    return sourceListUrl(url.searchParams) + url.hash
  } catch {
    return null
  }
}

// Source categories and page numbers belong to the source list, not the guide list.
// Carry the displayed query and route separately so refreshing/sharing the detail
// preserves both the selected procedure and the way back to its original list.
export function sourceGuideUrl(guideId: string, sourceParams: URLSearchParams, query: string, routeId?: string) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (routeId) params.set('route', routeId)
  const returnParams = pickParams(sourceParams, sourceListKeys)
  if (query) returnParams.set('q', query)
  else returnParams.delete('q')
  params.set('returnTo', sourceListUrl(returnParams))
  return `/guides/${encodeURIComponent(guideId)}${searchSuffix(params)}`
}

export function guideNavigation(params: URLSearchParams) {
  // Support links made by the previous website directory as well as new links.
  const sourceReturn = safeSourceReturn(params.get('returnTo'))
    ?? (params.get('kind') === 'websites' ? sourceListUrl(params) : null)
  const listParams = pickParams(params, sourceReturn ? ['q'] : guideListKeys)
  const relatedParams = new URLSearchParams(listParams)
  if (sourceReturn) relatedParams.set('returnTo', sourceReturn)
  return {
    backTo: sourceReturn ?? `/guides${searchSuffix(listParams)}`,
    backLabel: sourceReturn ? '信息源列表' : params.get('q') ? '搜索结果' : '办事指南',
    relatedSearch: searchSuffix(relatedParams),
  }
}
