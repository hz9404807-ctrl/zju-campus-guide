import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Pencil, LockKeyhole, MapPin } from 'lucide-react'
import { loadCampusAccountDetails, saveCampusAccountDetails } from '../lib/foodService'
import { accountCampuses, accountGenders, emptyCampusDetails, type CampusAccountDetails, type CampusAccountInput } from '../lib/campusAccountDetails'
import '../pages/personal-center.css'

export function PersonalDetailsCard({ userId }: { userId: string }) {
  const [details, setDetails] = useState<CampusAccountDetails | null>(null)
  const [draft, setDraft] = useState<CampusAccountInput>({ ...emptyCampusDetails })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const version = useRef(0)
  const saveLock = useRef(false)
  useEffect(() => {
    const request = ++version.current
    setDetails(null); setDraft({ ...emptyCampusDetails }); setLoading(true); setLoadError('')
    setSaveError(''); setSaved(false); setEditing(false); setSaving(false)
    loadCampusAccountDetails(userId).then((value) => {
      if (version.current === request) { setDetails(value); setLoading(false) }
    }).catch((error: unknown) => {
      if (version.current === request) { setLoadError(error instanceof Error ? error.message : '个人资料加载失败，请重试。'); setLoading(false) }
    })
    return () => { version.current += 1 }
  }, [userId, attempt])

  function startEdit() { setDraft(details ? { gender: details.gender, signature: details.signature, campus: details.campus } : { ...emptyCampusDetails }); setEditing(true); setSaveError(''); setSaved(false) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saveLock.current) return
    saveLock.current = true
    const request = version.current
    setSaving(true); setSaveError(''); setSaved(false)
    try {
      const value = await saveCampusAccountDetails(draft, details?.updated_at ?? null, userId)
      if (version.current === request) { setDetails(value); setEditing(false); setSaved(true) }
    } catch (error) {
      if (version.current === request) setSaveError(error instanceof Error ? error.message : '个人资料未保存，请重试。')
    } finally {
      saveLock.current = false
      if (version.current === request) setSaving(false)
    }
  }

  return <section className="account-details-card" aria-labelledby="account-details-title" aria-busy={loading || saving}>
    <div className="account-details-heading"><div><h2 id="account-details-title">个人资料</h2><p><LockKeyhole size={14} aria-hidden="true" />仅自己可见，所有信息均可不填。</p></div>
      {!loading && !loadError && !editing && <button type="button" className="account-details-edit" onClick={startEdit}><Pencil size={16} aria-hidden="true" />编辑资料</button>}
    </div>
    {loading ? <p className="account-details-state" role="status">正在加载个人资料…</p> : loadError ? <div className="account-details-state" role="alert"><p>{loadError}</p><button type="button" className="account-details-edit" onClick={() => setAttempt((value) => value + 1)}>重试个人资料</button></div> : editing ? <form className="account-details-form" onSubmit={submit}>
      <div className="account-details-fields"><label htmlFor="account-gender">性别<select id="account-gender" value={draft.gender} disabled={saving} onChange={(event) => setDraft({ ...draft, gender: event.target.value })}>{accountGenders.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label htmlFor="account-campus">常驻校区<select id="account-campus" value={draft.campus} disabled={saving} onChange={(event) => setDraft({ ...draft, campus: event.target.value })}><option value="">暂不填写</option>{accountCampuses.map((campus) => <option key={campus} value={campus}>{campus}校区</option>)}</select></label></div>
      <label htmlFor="account-signature">个性签名<input id="account-signature" type="text" value={draft.signature} disabled={saving} aria-describedby="account-signature-hint" onChange={(event) => setDraft({ ...draft, signature: event.target.value })} placeholder="用一句话介绍此刻的自己" /></label>
      <p id="account-signature-hint" className={Array.from(draft.signature).length > 120 ? 'account-details-error' : 'account-details-hint'}>{Array.from(draft.signature).length} / 120 字</p>
      {saveError && <div className="account-details-error" role="alert"><p>{saveError}</p><button type="button" className="account-details-edit" disabled={saving} onClick={() => setAttempt((value) => value + 1)}>重新加载资料（放弃当前编辑）</button></div>}
      <div className="account-details-actions"><button className="button-link" type="submit" disabled={saving || Array.from(draft.signature).length > 120}>{saving ? '正在保存…' : '保存资料'}</button><button className="account-details-edit" type="button" disabled={saving} onClick={() => { setEditing(false); setSaveError('') }}>取消</button></div>
    </form> : <>
      <dl className="account-details-values"><div><dt>性别</dt><dd>{accountGenders.find(({ value }) => value === details?.gender)?.label ?? '不透露'}</dd></div><div><dt><MapPin size={14} aria-hidden="true" />常驻校区</dt><dd>{details?.campus ? details.campus + '校区' : '暂未填写'}</dd></div></dl>
      <p className={`account-details-signature${details?.signature ? '' : ' is-empty'}`}>{details?.signature || '还没有填写个性签名'}</p>
      {saved && <p className="account-details-saved" role="status">个人资料已保存</p>}
    </>}
  </section>
}
