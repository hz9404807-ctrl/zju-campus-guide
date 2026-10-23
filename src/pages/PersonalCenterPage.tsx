import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowLeft, ArrowRight, CheckCircle2, LogOut, Star, UserRound, Mail, PenLine, ShieldCheck, ArrowUpRight } from 'lucide-react'
import { useFoodAuth } from '../hooks/useFoodAuth'
import { isFoodEmailAuthReady, signOutFood } from '../lib/foodService'
import { PersonalDetailsCard } from '../components/PersonalDetailsCard'
import './food.css'
import './food-account.css'

export function PersonalCenterPage() {
  const auth = useFoodAuth()
  const location = useLocation()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const returnTo = location.pathname + location.search + location.hash
  const verified = !auth.loading && !auth.error && auth.user?.verifiedCampus

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError('')
    try { await signOutFood(); auth.retry() }
    catch (error) { setSignOutError(error instanceof Error ? error.message : '退出失败，请重试。') }
    finally { setSigningOut(false) }
  }

  return <div className="page module-page personal-center-page">
    <Link className="breadcrumb" to="/"><ArrowLeft size={16} aria-hidden="true" />返回首页</Link>
    <div className="page-heading"><p className="eyebrow">你的校园生活记录</p><h1>个人中心</h1><p className="page-description">查看账号信息，管理发布，回看自己的评分。</p></div>
    {signOutError && <p className="food-account-notice" role="alert">{signOutError} 当前账号状态以页面重新检查结果为准。</p>}
    {(auth.loading || signingOut) ? <div className="food-load-state" role="status"><span className="food-loading-dot" /><p>{signingOut ? '正在退出，已收起个人内容…' : '正在确认登录状态…'}</p></div> : auth.error ? <div className="food-load-state" role="alert"><h2>暂时无法确认账号</h2><p>{auth.error}</p><button className="button-link" type="button" onClick={auth.retry}>重试账号检查</button></div> : !verified ? <section className="account-guest" aria-labelledby="account-login-title">
      <div className="account-guest-story">
        <span className="account-story-label">MY CAMPUS SPACE</span>
        <div className="account-avatar" aria-hidden="true"><UserRound size={36} /></div>
        <h2>校园生活，<br />留一点自己的印记。</h2>
        <p>分享尝过的美味，记住喜欢的那一口。</p>
        <div className="account-feature-list"><span><PenLine size={18} aria-hidden="true" />管理美食发布</span><span><Star size={18} aria-hidden="true" />回看真实评分</span></div>
      </div>
      <div className="account-guest-content">
        <span className="account-welcome-icon"><Mail size={25} aria-hidden="true" /></span>
        <h2 id="account-login-title">登录后查看你的内容</h2>
        <p>一封验证码邮件，开启你的校园生活记录。</p>
        <Link className="button-link" to={`/food/login?returnTo=${encodeURIComponent(returnTo)}`}>使用浙大邮箱登录 <ArrowRight size={17} aria-hidden="true" /></Link>
        {!isFoodEmailAuthReady && <p className="food-account-hint">当前环境尚未开放邮箱登录，登录页可查看说明。</p>}
        <p className="account-privacy"><ShieldCheck size={16} aria-hidden="true" />邮箱仅自己可见，无需提供邮箱密码。</p>
        <div className="account-guest-browse"><span>先逛逛也很好，浏览无需登录。</span><Link className="account-detail-link" to="/food">先去浏览美食 <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </section> : <>
      <section className="account-overview" aria-labelledby="account-overview-title">
        <div className="account-cover" aria-hidden="true"><span>YOUR CAMPUS, YOUR STORIES.</span></div><div className="account-profile-body"><div className="account-avatar" aria-hidden="true"><UserRound size={34} /></div><div className="account-overview-heading"><h2 id="account-overview-title">账号概览</h2><span className="account-verified"><CheckCircle2 size={17} aria-hidden="true" />浙大邮箱已验证</span></div>
        <dl><div><dt>登录邮箱</dt><dd>{auth.user!.email}</dd></div></dl>
        <p className="food-account-hint">邮箱仅在你自己的账号页面显示，不会出现在公开发布或评分中。一个邮箱对应一个登录账号。</p>
        <button type="button" className="account-sign-out" onClick={signOut}><LogOut size={17} aria-hidden="true" />退出登录</button></div>
      </section>
      <PersonalDetailsCard key={`details:${auth.user!.id}`} userId={auth.user!.id} />
      <nav className="account-record-links" aria-label="个人内容">
        <Link className="account-record-entry" to="/account/posts"><span className="account-record-icon"><PenLine size={24} aria-hidden="true" /></span><span><strong>我的发布</strong><small>编辑、撤下或恢复分享过的美食</small></span><ArrowRight size={20} aria-hidden="true" /></Link>
        <Link className="account-record-entry" to="/account/ratings"><span className="account-record-icon"><Star size={24} aria-hidden="true" /></span><span><strong>我的评分</strong><small>回看评分记录与菜品图片</small></span><ArrowRight size={20} aria-hidden="true" /></Link>
      </nav>
    </>}
  </div>
}
