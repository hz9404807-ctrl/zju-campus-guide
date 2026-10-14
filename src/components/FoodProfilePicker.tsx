import { useState } from 'react'
import type { FormEvent } from 'react'
import { useFoodProfiles } from '../hooks/useFoodProfiles'
import { MAX_FOOD_PROFILES } from '../lib/foodProfiles'
export default function FoodProfilePicker({ disabled = false }: { disabled?: boolean }) {
  const profiles = useFoodProfiles()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState('')
  if (!profiles.enabled) return null
  if (profiles.loading) return <p role="status">正在加载你的档案…</p>
  if (profiles.error) return <p role="alert">{profiles.error} <button type="button" onClick={profiles.reload}>重新加载档案</button></p>
  async function create(event: FormEvent) {
    event.preventDefault()
    if (disabled || profiles.creating) return
    setFeedback('')
    try { await profiles.create(name); setName(''); setOpen(false); setFeedback('档案已创建，正在切换。') }
    catch (error) { setFeedback(error instanceof Error ? error.message : '创建失败，请重试。') }
  }
  return <section className="food-profile-picker" aria-label="发布档案">
    <div className="food-profile-row"><label htmlFor="food-profile-select">当前档案</label><select id="food-profile-select" value={profiles.active?.id ?? ''} disabled={disabled || profiles.creating} onChange={(event) => { profiles.select(event.target.value); setFeedback(''); setOpen(false) }}>{profiles.items.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><span>{profiles.items.length} / {MAX_FOOD_PROFILES} 个档案</span>
      {profiles.items.length < MAX_FOOD_PROFILES ? <button type="button" disabled={disabled || profiles.creating} onClick={() => { setOpen(!open); setFeedback('') }}>{open ? '收起创建' : '创建档案'}</button> : <span>已使用全部五个档案</span>}
    </div>
    <p className="food-account-hint">{disabled ? '当前操作使用此档案；完成或返回我的发布后可切换。' : '切换后管理各自的发布。换设备登录同一邮箱，可找回全部档案。'}</p>
    {open && <form className="food-profile-create" onSubmit={create}><label htmlFor="food-profile-name">新档案名称</label><input id="food-profile-name" value={name} autoComplete="off" placeholder="例如：食堂探索" disabled={disabled || profiles.creating} onChange={(event) => setName(event.target.value)} /><p className="food-account-hint">填写1～24个字；名称仅用于你自己的档案管理。</p><div className="food-account-actions"><button type="submit" disabled={disabled || profiles.creating}>{profiles.creating ? '创建中…' : '创建并切换'}</button><button type="button" disabled={profiles.creating} onClick={() => { setOpen(false); setName(''); setFeedback('') }}>取消</button></div></form>}
    {feedback && <p role="status" aria-live="polite">{feedback}</p>}
  </section>
}
