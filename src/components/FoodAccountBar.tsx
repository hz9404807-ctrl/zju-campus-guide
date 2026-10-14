import FoodProfilePicker from './FoodProfilePicker'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { signOutFood } from '../lib/foodService'
import type { useFoodAuth } from '../hooks/useFoodAuth'
import '../pages/food-account.css'
export default function FoodAccountBar({ auth, profileLocked = false }: { auth: ReturnType<typeof useFoodAuth>; profileLocked?: boolean }) {
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <div className="food-account-bar"><div>{auth.loading ? <span role="status">正在检查账号…</span> : auth.user?.verifiedCampus ? <><span>浙大邮箱已登录</span><Link to="/food/mine">我的发布</Link><button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await signOutFood() } catch (e) { setError(e instanceof Error ? e.message : '退出失败，请重试。') } finally { setBusy(false) } }}>{busy ? '退出中…' : '退出登录'}</button></> : <><span>浏览无需登录，发布和管理使用浙大邮箱。</span><Link to={`/food/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>浙大邮箱登录</Link></>}</div><FoodProfilePicker key={auth.user?.id ?? 'guest'} disabled={profileLocked || busy} />{(error || auth.error) && <p role="alert">{error || auth.error}<button type="button" onClick={auth.retry}>重试账号检查</button></p>}</div>
}
