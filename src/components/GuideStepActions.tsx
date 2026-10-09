import { ExternalLink, MapPin } from 'lucide-react'
import type { GuideStepAction } from '../types/guide'

export default function GuideStepActions({ actions }: { actions: GuideStepAction[] }) {
  if (!actions.length) return null
  return <div className="guide-step-actions">{actions.map((action, index) =>
    action.kind === 'windows' ? <a className="guide-action-button" key={index} href="#guide-windows-heading"><MapPin size={15} aria-hidden="true" />{action.label}</a> :
    <a className="guide-action-button" key={index} href={action.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />{action.label}<span className="guide-reference-note">（新标签页）</span></a>
  )}</div>
}
