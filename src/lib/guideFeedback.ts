import type { Guide } from '../types/guide'

const issueEndpoint = 'https://github.com/hz9404807-ctrl/zju-campus-guide/issues/new'
export const GUIDE_FEEDBACK_LIMIT = 500
export const guideFeedbackKinds = [
  { value: 'link', label: '链接打不开' },
  { value: 'changed', label: '时间、地点或流程有变化' },
  { value: 'missing', label: '缺少办理信息' },
  { value: 'other', label: '其他问题' },
] as const

type FeedbackGuide = Pick<Guide, 'id' | 'title' | 'routes'>

function safeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value)
}

function text(value: unknown, limit: number) {
  if (typeof value !== 'string') return ''
  // Match the textarea's UTF-16 maxlength, without leaving half an emoji.
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, limit).replace(/[\ud800-\udbff]$/, '')
}

// Rebuild context from the guide dataset. Browser search, returnTo and host-frame
// parameters are intentionally outside this interface.
export function guideFeedbackPath(guide: FeedbackGuide, routeId?: string) {
  if (!safeId(guide.id)) return null
  const route = safeId(routeId) ? guide.routes?.find((item) => item.id === routeId) : undefined
  const params = new URLSearchParams()
  if (route) params.set('route', route.id)
  return `/guides/${guide.id}${params.size ? `?${params.toString()}` : ''}`
}

export function buildGuideFeedback(guide: FeedbackGuide, routeId: string | undefined, kind: string, description: string) {
  const path = guideFeedbackPath(guide, routeId)
  if (!path) return null
  const category = guideFeedbackKinds.find((item) => item.value === kind) ?? guideFeedbackKinds[3]
  const title = text(guide.title, 80).replace(/\s+/g, ' ') || guide.id
  const route = safeId(routeId) ? guide.routes?.find((item) => item.id === routeId) : undefined
  const details = text(description, GUIDE_FEEDBACK_LIMIT)
  const body = [
    `指南：${title}`,
    `指南 ID：${guide.id}`,
    ...(route ? [`办理路线：${text(route.label, 60).replace(/\s+/g, ' ')}（${route.id}）`] : []),
    `页面：${path}`,
    `问题类型：${category.label}`,
    '',
    '问题说明：',
    details || '请在提交前补充遇到的情况，以及可供核对的公开来源。',
  ].join('\n')
  const url = new URL(issueEndpoint)
  url.searchParams.set('title', `[指南反馈] ${category.label} · ${title}`)
  url.searchParams.set('body', body)
  return { path, text: body, issueUrl: url.href }
}

// Dates describe existing collection/review records; rendering never supplies
// today's date or infers verification from a successful link request.
export function recordedGuideDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
