import { useState } from 'react'
import { ExternalLink, Phone } from 'lucide-react'
import type { ServiceWindow } from '../types/guide'

export default function GuideServiceWindows({ windows }: { windows: ServiceWindow[] }) {
  const [campus, setCampus] = useState(windows[0]?.campus ?? '')
  const campuses = [...new Set(windows.map((window) => window.campus))]
  const visible = windows.filter((window) => !campus || window.campus === campus)
  const references = [...new Map(visible.flatMap((window) => window.references ?? []).map((reference) => [reference.url, reference])).values()]
  return <aside className="guide-detail-section guide-windows" aria-labelledby="guide-windows-heading">
    <h2 id="guide-windows-heading">办理地点与时间</h2>
    <div className="guide-window-filter">
      <label htmlFor="guide-service-campus">选择办理校区</label>
      <select id="guide-service-campus" value={campus} onChange={(event) => setCampus(event.target.value)}>
        <option value="">全部校区</option>
        {campuses.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
    <p className="guide-window-count" role="status" aria-live="polite">显示{visible.length}个服务点</p>
    <div className="guide-window-list">
      {visible.map((window) => <article key={window.id} className="guide-window-card" aria-label={`${window.campus} ${window.name}`}>
        <p className="guide-window-campus">{window.campus}</p>
        <h3>{window.name}</h3>
        {window.hoursStatus === 'needs_confirmation' && <p className="guide-window-pending">开放时间待确认</p>}
        <dl className="guide-window-details">
          <div><dt>地点</dt><dd>{window.location}</dd></div>
          <div><dt>常规开放时间</dt><dd>{window.openingHours}</dd></div>
          <div><dt>电话</dt><dd>{window.contacts.map((contact) => <a className="guide-window-phone" key={contact.number} href={`tel:${contact.number.replace(/[^\d+]/g, '')}`}><Phone size={14} aria-hidden="true" /><span>{contact.number}{window.contacts.length > 1 ? `（${contact.label}）` : ''}</span></a>)}</dd></div>
        </dl>
        {window.notice && <p className="guide-window-notice">{window.notice}</p>}
      </article>)}
    </div>
    <ul className="guide-material-list guide-window-reminders">
      <li>寒暑假及法定节假日可能调整，请向对应窗口确认当期安排。</li>
    </ul>
    <div className="guide-window-references">
      {references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}<ExternalLink size={14} aria-hidden="true" /></a>)}
    </div>
  </aside>
}
