import { useState } from 'react'
import { ExternalLink, Phone } from 'lucide-react'
import CopyTextButton from './CopyTextButton'
import { readCampusPreference, saveCampusPreference } from '../lib/campusPreference'
import type { ServiceWindow } from '../types/guide'

function browserStorage() {
  try { return window.localStorage } catch { return null }
}

export default function GuideServiceWindows({ windows, allCampuses, context }: { windows: ServiceWindow[]; allCampuses: string[]; context?: string | null }) {
  const campuses = [...new Set(allCampuses)]
  const multipleCampuses = new Set(windows.map((window) => window.campus)).size > 1
  const [campus, setCampus] = useState(() => readCampusPreference(browserStorage(), [...new Set(windows.map((window) => window.campus))], windows[0]?.campus ?? '') || windows[0]?.campus || '')
  const [preferenceError, setPreferenceError] = useState(false)
  function chooseCampus(value: string) {
    setCampus(value)
    setPreferenceError(!saveCampusPreference(browserStorage(), value))
  }
  const visible = windows.filter((window) => !campus || window.campus === campus)
  const references = [...new Map(visible.flatMap((window) => window.references ?? []).map((reference) => [reference.url, reference])).values()]
  return <aside className="guide-detail-section guide-windows" aria-labelledby="guide-windows-heading">
    <h2 id="guide-windows-heading" tabIndex={-1}>办理地点与时间</h2>
    {context && <p className="guide-window-context">{context}</p>}
    {multipleCampuses && <div className="guide-window-filter">
      <span>选择办理校区</span>
      <div className="guide-campus-buttons" role="group" aria-label="办理校区">{campuses.map((item) => <button key={item} type="button" aria-pressed={campus === item} onClick={() => chooseCampus(item)}>{item}</button>)}</div>
    </div>}
    {multipleCampuses && <p className="guide-preference-note">校区选择保存在当前浏览器，可随时切换。</p>}
    {preferenceError && <p className="guide-window-notice" role="status">本次切换已生效，但浏览器未能保存；下次可能需要重新选择。</p>}
    <p className="guide-window-count" role="status" aria-live="polite">显示{visible.length}个服务点</p>
    {visible.length === 0 && <div className="guide-window-unavailable"><p>当前事项未收录{campus}的服务窗口。请选择其他校区，或查看已收录校区。</p><button type="button" className="guide-action-button" onClick={() => chooseCampus(windows[0]?.campus ?? '')}>查看已收录校区</button></div>}
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
        <div className="guide-window-actions"><CopyTextButton text={`浙江大学${window.campus}校区 · ${window.name}：${window.location}`} label="复制地址" /><a className="guide-action-button" href="https://map.zju.edu.cn" target="_blank" rel="noopener noreferrer">打开官方校园地图<ExternalLink size={14} aria-hidden="true" /></a></div>
        <p className="guide-map-hint">可在官方地图中查找上述地点；具体窗口按本页地址和现场标识确认。</p>
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
