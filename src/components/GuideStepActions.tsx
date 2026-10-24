import { MapPin } from 'lucide-react'
import type { GuideStepAction } from '../types/guide'
import GuideExternalLink from './GuideExternalLink'

export default function GuideStepActions({ actions }: { actions: GuideStepAction[] }) {
  if (!actions.length) return null
  return <div className="guide-step-actions">{actions.map((action, index) =>
    action.kind === 'windows' ? <a className="guide-action-button" key={index} href="#guide-windows-heading"><MapPin size={15} aria-hidden="true" />{action.label}</a> :
    <GuideExternalLink key={index} action={action} />
  )}</div>
}
