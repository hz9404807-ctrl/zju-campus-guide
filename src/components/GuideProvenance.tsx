import { useId, useState } from 'react'
import { ExternalLink, MessageSquare } from 'lucide-react'
import CopyTextButton from './CopyTextButton'
import { buildGuideFeedback, GUIDE_FEEDBACK_LIMIT, guideFeedbackKinds, guideFeedbackPath } from '../lib/guideFeedback'
import type { Guide } from '../types/guide'
import './guide-provenance.css'

export default function GuideProvenance({ guide, routeId }: { guide: Guide; routeId?: string }) {
  return <section className="guide-provenance" aria-labelledby="guide-provenance-heading">
    <GuideFeedback key={guideFeedbackPath(guide, routeId)} guide={guide} routeId={routeId} />
  </section>
}

function GuideFeedback({ guide, routeId }: { guide: Guide; routeId?: string }) {
  const id = useId()
  const [kind, setKind] = useState<string>(guideFeedbackKinds[0].value)
  const [description, setDescription] = useState('')
  const draft = buildGuideFeedback(guide, routeId, kind, description)
  return <details className="guide-feedback">
    <summary id="guide-provenance-heading"><MessageSquare size={17} aria-hidden="true" /><span>发现信息有误？反馈给项目组</span></summary>
    <div className="guide-feedback-content">
      <p id={`${id}-privacy`} className="guide-feedback-privacy">需登录 GitHub，提交后内容公开。请只填写办理问题和公开来源，勿填写姓名、学号、邮箱、验证码等个人信息。</p>
      <div className="guide-feedback-field"><label htmlFor={`${id}-kind`}>遇到了什么问题？</label><select id={`${id}-kind`} value={kind} onChange={(event) => setKind(event.target.value)}>{guideFeedbackKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      <div className="guide-feedback-field"><label htmlFor={`${id}-description`}>补充说明（选填）</label><textarea id={`${id}-description`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={GUIDE_FEEDBACK_LIMIT} rows={3} placeholder="例如：页面中的窗口已搬迁，可参考这条公开通知……" aria-describedby={`${id}-privacy ${id}-count`} /><span id={`${id}-count`} className="guide-feedback-count">{description.length}/{GUIDE_FEEDBACK_LIMIT}</span></div>
      {draft ? <><div className="guide-feedback-actions"><CopyTextButton text={draft.text} label="复制反馈内容" /><a className="guide-action-button guide-feedback-submit" href={draft.issueUrl} target="_blank" rel="noopener noreferrer">前往 GitHub 提交<ExternalLink size={15} aria-hidden="true" /></a></div><p className="guide-feedback-next">将在 GitHub 打开反馈草稿，检查内容后点击「Submit new issue」提交。</p></> : <p role="status">暂时无法生成这份指南的反馈，请返回指南列表重新打开。</p>}
    </div>
  </details>
}
