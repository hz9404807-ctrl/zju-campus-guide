import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { campusEmail, FoodCodeDeliveryUnknown, safeFoodReturn } from '../lib/foodAuth'
import { isFoodEmailAuthReady, sendFoodCode, verifyFoodCode } from '../lib/foodService'
import { useFoodAuth } from '../hooks/useFoodAuth'
import { clearFoodLoginDraft, foodLoginStorage, loginDraftCooldown, readFoodLoginDraft, saveFoodLoginDraft } from '../lib/foodLoginDraft'
import { Mail, ShieldCheck, PenLine, Star } from 'lucide-react'
import './food-account.css'
export function FoodLoginPage() {
  const auth = useFoodAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = safeFoodReturn(params.get('returnTo'))
  const returnLabel = returnTo.split(/[?#]/)[0].startsWith('/account') ? '返回个人中心' : '返回美食页面'
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'bind' | 'login'>('bind')
  const [pending, setPending] = useState<{ email: string; type: 'email_change' | 'email'; delivery: 'accepted' | 'unknown' } | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const lock = useRef(false)
  const recoveryOwner = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (auth.loading) return
    if (auth.user?.verifiedCampus) { clearFoodLoginDraft(foodLoginStorage()); return }
    const ownerId = auth.user?.id ?? null
    if (recoveryOwner.current === ownerId) return
    recoveryOwner.current = ownerId
    const draft = readFoodLoginDraft(foodLoginStorage(), ownerId)
    setToken('')
    if (draft) {
      setEmail(draft.email); setMode(draft.mode); setPending(draft)
      setCooldown(loginDraftCooldown(draft.sentAt)); setFeedback('已恢复上次验证，请填写邮件中的验证码。')
    } else { setPending(null); setCooldown(0) }
  }, [auth.loading, auth.user?.id, auth.user?.verifiedCampus])
  function rememberPending(address: string, type: 'email_change' | 'email', delivery: 'accepted' | 'unknown', sentAt = Date.now()) {
    const draft = { email: address, type, delivery, mode, ownerId: auth.user?.id ?? null, sentAt }
    setPending(draft); saveFoodLoginDraft(foodLoginStorage(), draft)
  }
  function resumeReceivedCode() {
    const address = campusEmail(email)
    if (!address) { setFeedback('请先填写收到验证码的浙大邮箱。'); return }
    rememberPending(address, mode === 'bind' && auth.user?.anonymous ? 'email_change' : 'email', 'unknown', Date.now() - 60000)
    setToken(''); setCooldown(0); setFeedback('请填写已收到的完整验证码。此操作不会重新发送邮件。')
  }
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown((n) => n - 1), 1000); return () => clearTimeout(timer) }, [cooldown])
  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (lock.current || cooldown || !isFoodEmailAuthReady) return
    const address = campusEmail(email)
    if (!address) { setFeedback('请填写以 @zju.edu.cn 结尾的浙大邮箱。'); return }
    lock.current = true; setBusy(true); setFeedback('')
    try { const type = await sendFoodCode(address, mode); rememberPending(address, type, 'accepted'); setToken(''); setCooldown(60); setFeedback('验证码发送请求已完成，请查看收件箱或垃圾邮件。') }
    catch (e) {
      if (e instanceof FoodCodeDeliveryUnknown) {
        rememberPending(address, e.type, 'unknown'); setToken(''); setCooldown(60)
      }
      setFeedback(e instanceof Error ? e.message : '发送失败，请重试。')
    }
    finally { lock.current = false; setBusy(false) }
  }
  async function verify(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !pending) return
    lock.current = true; setBusy(true); setFeedback('')
    try { await verifyFoodCode(pending.email, token, pending.type); clearFoodLoginDraft(foodLoginStorage()); navigate(returnTo, { replace: true }) }
    catch (e) { setFeedback(e instanceof Error ? e.message : '验证失败，请重试。') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="page module-page food-login-page"><Link className="breadcrumb" to={returnTo}>{returnLabel}</Link><div className="login-layout"><div className="login-story"><span className="account-story-label">ZJU · CAMPUS LIFE</span><div className="login-story-mark" aria-hidden="true"><Mail size={42} /></div><h1>很高兴，<br />在这里遇见你。</h1><p>让尝过的美味有迹可循，<br />让每一次分享都有归处。</p><div className="account-feature-list"><span><PenLine size={18} aria-hidden="true" />发布与管理美食</span><span><Star size={18} aria-hidden="true" />记录自己的评分</span></div><p className="login-story-footer">你的校园生活，从这里继续。</p></div>
    <section className="food-login-panel" aria-label="邮箱验证"><div className="login-panel-heading"><span className="account-welcome-icon"><Mail size={24} aria-hidden="true" /></span><h2>浙大邮箱登录</h2><p>{isFoodEmailAuthReady ? (pending ? '最后一步，验证你的邮箱。' : '使用校园邮箱，找回你的发布与评分。') : '邮箱登录尚未开通，你仍可浏览校园美食。'}</p></div>
      {auth.user?.verifiedCampus ? <><p>你已经使用浙大邮箱登录。</p><Link className="button-link" to={returnTo}>继续浏览</Link><Link className="button-link" to="/account/posts">我的发布</Link></> : !isFoodEmailAuthReady ? <><p className="food-account-notice" role="status">邮箱登录尚未开通，当前无法发送验证码。开通后可使用浙大邮箱登录，管理自己的发布。</p><Link className="button-link" to="/food">返回浏览美食</Link></> : pending ? <form onSubmit={verify}><p>{pending.delivery === 'unknown' ? '发送结果尚未确认。若以下邮箱收到验证码，可继续验证：' : '请查看以下邮箱中的验证码：'} <strong>{pending.email}</strong></p><label htmlFor="food-otp">邮件验证码</label><input id="food-otp" autoComplete="one-time-code" inputMode="numeric" maxLength={10} value={token} onChange={(e) => setToken(e.target.value)} disabled={busy} /><button className="button-link" disabled={busy} type="submit">{busy ? '验证中…' : '验证并登录'}</button><div className="food-account-actions"><button type="button" disabled={busy || cooldown > 0} onClick={() => send()}>{cooldown ? `${cooldown}秒后可重发` : '重新发送'}</button><button type="button" disabled={busy} onClick={() => { clearFoodLoginDraft(foodLoginStorage()); setPending(null); setToken(''); setFeedback('') }}>修改邮箱</button></div></form> : <form onSubmit={send}><label htmlFor="food-email">浙大邮箱</label><input id="food-email" type="email" autoComplete="email" placeholder="你的账号@zju.edu.cn" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /><fieldset className="food-login-modes" disabled={busy}><legend>选择登录方式</legend><label><input type="radio" name="food-login-mode" value="bind" checked={mode === 'bind'} onChange={() => setMode('bind')} />首次使用 / 绑定本浏览器的发布</label><label><input type="radio" name="food-login-mode" value="login" checked={mode === 'login'} onChange={() => setMode('login')} />已有邮箱账号登录</label></fieldset><p className="food-account-hint">已有匿名发布请先绑定。直接登录已有账号不会自动转移旧匿名发布。</p><button type="submit" className="button-link" disabled={busy || auth.loading || cooldown > 0 || !isFoodEmailAuthReady}>{busy ? '发送中…' : cooldown ? `${cooldown}秒后可发送` : '发送验证码'}</button><div className="food-account-actions"><button type="button" onClick={resumeReceivedCode} disabled={busy || auth.loading}>已收到验证码，直接验证</button></div></form>}
      {feedback && <p className="food-account-feedback" role="status" aria-live="polite">{feedback}</p>}{isFoodEmailAuthReady && auth.error && <p role="alert">{auth.error}<button type="button" onClick={auth.retry}>重新检查账号</button></p>}
      {isFoodEmailAuthReady && <p className="food-account-hint login-privacy"><ShieldCheck size={17} aria-hidden="true" />本站使用邮件验证码，不需要你的邮箱密码。邮箱地址不展示给其他访问者。</p>}
    </section></div></div>
}
