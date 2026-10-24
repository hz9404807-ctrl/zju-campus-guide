import { ExternalLink } from 'lucide-react'
import { describeGuideExternalAction } from '../lib/guideExternalLink'
import type { GuideExternalAction } from '../lib/guideExternalLink'
import './guide-external-link.css'

interface GuideExternalLinkProps {
  action: GuideExternalAction
  variant?: 'button' | 'card' | 'inline'
  className?: string
}

export default function GuideExternalLink({ action, variant = 'button', className = '' }: GuideExternalLinkProps) {
  const link = describeGuideExternalAction(action)
  const classes = `guide-outbound-link guide-outbound-${variant}${className ? ` ${className}` : ''}`
  if (!link) return <span className={`${classes} guide-outbound-unavailable`} aria-disabled="true"><span className="guide-outbound-label">{action.label}</span><span className="guide-outbound-meta">链接暂不可用</span></span>
  return <a href={link.href} target="_blank" rel="noopener noreferrer" className={classes}>
    <span className="guide-outbound-heading"><span className="guide-outbound-kind">{link.category}</span><span className="guide-outbound-label">{link.label}</span><ExternalLink size={15} aria-hidden="true" /></span>
    <span className="guide-outbound-meta"><span>{link.destination}</span><span aria-hidden="true"> · </span><span>{link.newWindowText}</span></span>
  </a>
}
