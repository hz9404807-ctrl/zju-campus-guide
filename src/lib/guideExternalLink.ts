import type { GuideStepAction } from '../types/guide'

export type GuideExternalAction = Pick<Extract<GuideStepAction, { url: string }>, 'kind' | 'label' | 'url'>

// These are display/navigation checks, not a claim that the destination is reachable.
// Keep the collected URL intact; use the parsed host only for the destination label.
export function guideExternalDestination(value: string) {
  if (!/^https?:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (url.username || url.password || !hostname.includes('.')) return null
    // Only public DNS names are supported by the collected directory. Local names,
    // literal IP addresses and non-web schemes must never become external actions.
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname) || hostname.includes('..') ||
      /^\d+(?:\.\d+){3}$/.test(hostname) ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(hostname)) return null
    return {
      href: value,
      hostname,
      destination: `${hostname}${url.port ? `:${url.port}` : ''}`,
      university: hostname === 'zju.edu.cn' || hostname.endsWith('.zju.edu.cn'),
    }
  } catch {
    return null
  }
}

export function describeGuideExternalAction(action: GuideExternalAction) {
  const destination = guideExternalDestination(action.url)
  if (!destination) return null
  const forum = destination.hostname === 'cc98.org' || destination.hostname.endsWith('.cc98.org')
  const category = forum ? '论坛参考' : action.kind === 'service'
    ? destination.university ? '官方入口' : '外部服务'
    : destination.university ? '官方参考' : '参考资料'
  return { ...destination, label: action.label, category, newWindowText: '新窗口打开' }
}
