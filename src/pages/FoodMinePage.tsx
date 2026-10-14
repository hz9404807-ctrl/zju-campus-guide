import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useFoodProfiles } from '../hooks/useFoodProfiles'
import { useFoodAuth } from '../hooks/useFoodAuth'
import { useFoodResource } from '../hooks/useFoodResource'
import { myFoods, setFoodDeleted } from '../lib/foodService'
import FoodAccountBar from '../components/FoodAccountBar'
import type { Food } from '../types/food'
import './food.css'
import './food-account.css'
export function FoodMinePage() {
  const auth = useFoodAuth()
  const profiles = useFoodProfiles()
  const profileId = profiles.active?.id
  const canLoad = !!auth.user?.verifiedCampus && (!profiles.enabled || (!!profileId && !profiles.loading && !profiles.error))
  const load = useCallback(() => canLoad ? myFoods(profileId) : Promise.resolve([] as Food[]), [auth.user?.id, canLoad, profileId])
  const resource = useFoodResource(load)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  useEffect(() => { setConfirm(null); setFeedback('') }, [auth.user?.id, profileId])
  async function change(food: Food, deleted: boolean) {
    if (busy) return
    setBusy(true); setFeedback('')
    try { await setFoodDeleted(food.id, food.updated_at!, deleted, profileId); setConfirm(null); setFeedback(deleted ? '已删除，公共页面不再展示。你可以在这里恢复。' : '已恢复发布。'); resource.refresh() }
    catch (e) { setFeedback(e instanceof Error ? e.message : '操作失败，请重试。') }
    finally { setBusy(false) }
  }
  return <div className="page module-page food-page"><Link className="breadcrumb" to="/food">返回美食列表</Link><div className="page-heading"><h1>我的发布</h1><p className="page-description">编辑菜品信息，或删除不再需要的发布。删除后可以恢复，已有评分保留。</p></div><FoodAccountBar auth={auth} profileLocked={busy} />
    {!auth.loading && !auth.user?.verifiedCampus && <p className="food-account-notice">请<Link to="/food/login?returnTo=%2Ffood%2Fmine">使用浙大邮箱登录</Link>查看自己的发布。已有匿名发布请在原浏览器完成邮箱绑定。</p>}
    {resource.loading && <p role="status">正在加载…</p>}{resource.error && <p role="alert">{resource.error}<button type="button" className="button-link" onClick={resource.reload}>重试</button></p>}{feedback && <p className="food-account-feedback" role="status">{feedback}<button type="button" className="button-link" disabled={busy} onClick={resource.reload}>刷新我的发布</button></p>}
    {canLoad && !resource.loading && !resource.error && !resource.data?.length && <div className="food-no-results"><h2>{profiles.active ? profiles.active.name + '还没有发布美食' : '你还没有发布美食'}</h2><p>分享一道吃过的菜吧。旧匿名发布需先在原浏览器绑定，不会仅凭邮箱自动认领。</p><Link className="button-link" to="/food/new">发布一道菜</Link></div>}
    <ul className="guide-result-grid">{resource.data?.map((food) => <li key={food.id}><article className="guide-result-card"><h2>{food.name}</h2><p>{food.location}</p><p>{food.deleted_at ? '已删除，仅你可管理' : '已发布'}</p><div className="food-account-actions">{food.deleted_at ? <button type="button" disabled={busy || resource.loading || !food.updated_at} onClick={() => change(food, false)}>恢复发布</button> : <><Link to={`/food/${food.id}`}>查看发布</Link>{food.updated_at && <Link to={`/food/${food.id}/edit`}>编辑</Link>}{food.updated_at && <button className="food-delete-button" type="button" disabled={busy || resource.loading} onClick={() => setConfirm(food.id)}>删除</button>}</>}</div>{!food.updated_at && <p>发布管理暂未开放。</p>}{confirm === food.id && <div className="food-delete-confirm"><p>删除“{food.name}”？公共列表和详情将不再展示，已有评分保留，你可以恢复。</p><div className="food-account-actions"><button type="button" className="food-delete-button" disabled={busy} onClick={() => change(food, true)}>{busy ? '删除中…' : '确认删除'}</button><button type="button" disabled={busy} onClick={() => setConfirm(null)}>取消</button></div></div>}</article></li>)}</ul>
  </div>
}
