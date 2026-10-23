import FoodProfilePicker from './FoodProfilePicker'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { signOutFood } from '../lib/foodService'
import type { useFoodAuth } from '../hooks/useFoodAuth'
import { BadgeCheck, LogOut, UserRound, PenLine } from 'lucide-react'
import '../pages/food-account.css'
export default function FoodAccountBar({ auth, profileLocked = false, compact = false, navigation = 'full' }: { auth: ReturnType<typeof useFoodAuth>; profileLocked?: boolean; compact?: boolean; navigation?: 'full' | 'session' }) {
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <div className={`food-account-bar${navigation === 'session' ? ' food-account-bar-session' : ''}`}>
    <div className="food-account-row">
      {auth.loading ? <span role="status">正在检查账号…</span> : auth.user?.verifiedCampus ? <>
        <span className="food-account-status"><BadgeCheck size={16} aria-hidden="true" />浙大邮箱已登录</span>
        <nav className="food-account-links" aria-label="美食账号操作">
          {navigation === 'full' && <><Link className="food-account-action" to="/account"><UserRound size={16} aria-hidden="true" />个人中心</Link>
          <Link className="food-account-action" to="/account/posts"><PenLine size={16} aria-hidden="true" />我的发布</Link></>}
          <button className="food-account-action" type="button" disabled={busy} onClick={async () => {
            setBusy(true); setError('')
            try { await signOutFood(); auth.retry() }
            catch (e) { setError(e instanceof Error ? e.message : '退出失败，请重试。') }
            finally { setBusy(false) }
          }}><LogOut size={16} aria-hidden="true" />{busy ? '退出中…' : '退出登录'}</button>
        </nav>
      </> : <>
        <span className="food-account-status">{compact ? '浏览免登录 · 发布和评分需验证邮箱' : '浏览无需登录，发布、评分和管理使用浙大邮箱。'}</span>
        <Link className="food-account-action" to={`/food/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`}>浙大邮箱登录</Link>
      </>}
    </div>
    <FoodProfilePicker key={auth.user?.id ?? 'guest'} disabled={profileLocked || busy} />
    {(error || auth.error) && <p role="alert">{error || auth.error}<button type="button" onClick={auth.retry}>重试账号检查</button></p>}
  </div>
}
