export const personalRecordsPageSize = 6
const recordPaths = ['/account/posts', '/account/ratings', '/food/mine'] as const
const localOrigin = 'https://campus-guide.invalid'

/** Personal list return links contain only a known route and a whole page number. */
export function personalRecordReturn(params: URLSearchParams): { url: string; label: string } | null {
  const value = params.get('returnTo')
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const url = new URL(value, localOrigin)
    if (url.origin !== localOrigin || !recordPaths.some((path) => path === url.pathname)) return null
    const raw = url.searchParams.get('page')
    const page = raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 1
    return { url: `${url.pathname}${page > 1 ? `?page=${page}` : ''}`, label: url.pathname === '/account/ratings' ? '返回我的评分' : '返回我的发布' }
  } catch { return null }
}

function personalReturnSearch(returnUrl: string) {
  const target = personalRecordReturn(new URLSearchParams({ returnTo: returnUrl }))
  return target ? `?${new URLSearchParams({ returnTo: target.url })}` : ''
}

export function personalFoodUrl(foodId: string, returnUrl: string, edit = false) {
  return `/food/${encodeURIComponent(foodId)}${edit ? '/edit' : ''}${personalReturnSearch(returnUrl)}`
}

export function personalPublishUrl(returnUrl: string) {
  return `/food/new${personalReturnSearch(returnUrl)}`
}
