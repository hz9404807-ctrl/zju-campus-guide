import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useFoodProfiles } from '../hooks/useFoodProfiles'
import { useFoodResource } from '../hooks/useFoodResource'
import { myFoods, setFoodDeleted } from '../lib/foodService'
import type { Food } from '../types/food'
import { FoodImage } from './FoodImage'

/** Mount under a verified account and key by its ID so pending actions cannot cross accounts. */
export function OwnedFoodList({ onBusyChange, onChanged }: { onBusyChange?: (busy: boolean) => void; onChanged?: () => void }) {
  const profiles = useFoodProfiles()
  const profileId = profiles.active?.id
  const profileBlocked = profiles.enabled && (profiles.loading || !!profiles.error || !profileId)
  const load = useCallback(() => profileBlocked ? Promise.resolve([] as Food[]) : myFoods(profileId), [profileId, profileBlocked])
  const resource = useFoodResource(load)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const lock = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; onBusyChange?.(false) }
  }, [onBusyChange])

  async function change(food: Food, deleted: boolean) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    onBusyChange?.(true)
    setFeedback('')
    try {
      await setFoodDeleted(food.id, food.updated_at!, deleted, profileId)
      if (!mounted.current) return
      setConfirm(null)
      setFeedback(deleted ? '已撤下，公共页面不再展示。已有评分保留，你可以在这里恢复。' : '已恢复发布。')
      resource.reload()
      onChanged?.()
    } catch (error) {
      if (mounted.current) setFeedback(error instanceof Error ? error.message : '操作失败，请重试。')
    } finally {
      lock.current = false
      if (mounted.current) { setBusy(false); onBusyChange?.(false) }
    }
  }

  if (profileBlocked) return <p role={profiles.error ? 'alert' : 'status'}>{profiles.error || '正在准备发布管理…'}{profiles.error && <button type="button" className="account-text-button" onClick={profiles.reload}>重试</button>}</p>
  return <div aria-busy={resource.loading || busy}>
    {resource.loading && <p className="account-state" role="status">正在加载我的发布…</p>}
    {resource.error && <div className="account-state" role="alert"><p>{resource.error}</p><button type="button" className="button-link" onClick={resource.reload}>重试我的发布</button></div>}
    {feedback && <p className="food-account-feedback" role="status">{feedback}</p>}
    {!resource.loading && !resource.error && !resource.data?.length && <div className="account-empty"><h3>还没有发布美食</h3><p>分享一道你吃过的菜，方便同学参考。旧匿名发布需在原浏览器绑定邮箱，不会自动转移。</p><Link className="button-link" to="/food/new">发布一道菜</Link></div>}
    <ul className="account-item-list">{resource.data?.map((food) => <li key={food.id}>
      <article className="account-post">
        <div className="account-post-content">
        <div className="account-item-heading"><h3>{food.name}</h3><span className={`account-item-status${food.deleted_at ? ' withdrawn' : ''}`}>{food.deleted_at ? '已撤下' : '已发布'}</span></div>
        <p className="account-item-meta">{food.location}</p>
        <div className="food-account-actions">
          {food.deleted_at ? <button type="button" disabled={busy || resource.loading || !food.updated_at} onClick={() => change(food, false)}>恢复发布</button> : <>
            <Link to={`/food/${food.id}`}>查看发布</Link>
            {food.updated_at && <><Link to={`/food/${food.id}/edit`}>编辑</Link><button className="food-delete-button" type="button" disabled={busy || resource.loading} onClick={() => setConfirm(food.id)}>撤下</button></>}
          </>}
        </div>
        {!food.updated_at && <p className="food-account-hint">发布管理暂未接入，请联系项目维护者。</p>}
        </div>
        <FoodImage food={food} className="account-post-image" />
        {confirm === food.id && <div className="food-delete-confirm"><p>撤下“{food.name}”？公共列表和详情将不再展示，已有评分保留，你可以恢复。</p><div className="food-account-actions"><button className="food-delete-button" type="button" disabled={busy} onClick={() => change(food, true)}>{busy ? '撤下中…' : '确认撤下'}</button><button type="button" disabled={busy} onClick={() => setConfirm(null)}>取消</button></div></div>}
      </article>
    </li>)}</ul>
  </div>
}
