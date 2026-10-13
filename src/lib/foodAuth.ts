import type { SupabaseClient } from '@supabase/supabase-js'

export interface FoodUser { id: string; email: string; verifiedCampus: boolean; anonymous: boolean }
export function campusEmail(value: string) {
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@zju\.edu\.cn$/.test(email) ? email : null
}
export function safeFoodReturn(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/food'
  try {
    const url = new URL(value, 'https://local.invalid')
    return url.origin === 'https://local.invalid' && (url.pathname === '/food' || url.pathname.startsWith('/food/')) && !url.pathname.startsWith('/food/login') ? url.pathname + url.search + url.hash : '/food'
  } catch { return '/food' }
}
export function foodUser(user: { id: string; email?: string; email_confirmed_at?: string; is_anonymous?: boolean }): FoodUser {
  return { id: user.id, email: user.email ?? '', anonymous: user.is_anonymous === true,
    verifiedCampus: user.is_anonymous === false && !!user.email_confirmed_at && !!campusEmail(user.email ?? '') }
}
export function createFoodAuth(client: SupabaseClient) {
  async function currentUser(): Promise<FoodUser | null> {
    const session = await client.auth.getSession()
    if (session.error) throw new Error('账号加载失败，请重试。')
    if (!session.data.session) return null
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) throw new Error('暂时无法验证登录状态，请检查网络后重试。')
    return foodUser(data.user)
  }
  async function sendCode(value: string, mode: 'bind' | 'login'): Promise<'email_change' | 'email'> {
    const email = campusEmail(value)
    if (!email) throw new Error('请填写以 @zju.edu.cn 结尾的浙大邮箱。')
    const user = await currentUser()
    if (mode === 'bind' && user?.anonymous) {
      const { error } = await client.auth.updateUser({ email })
      if (error) throw new Error(/already|registered|exists/i.test(error.message) ? '该邮箱已有账号，请选择“已有邮箱账号登录”。旧匿名发布不会自动转移。' : '绑定邮件未能发送，请稍后重试；若持续失败，请联系项目维护者。')
      return 'email_change'
    }
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: mode !== 'login' } })
    if (error) throw new Error(error.code === 'over_email_send_rate_limit' ? '发送过于频繁，请稍后再试。' : '验证码未能发送，请检查邮箱是否已注册，或稍后重试。')
    return 'email'
  }
  async function verifyCode(value: string, token: string, type: 'email_change' | 'email') {
    const email = campusEmail(value)
    if (!email || !/^\d{6}$/.test(token.trim())) throw new Error('请填写浙大邮箱和邮件中的6位验证码。')
    const { error } = await client.auth.verifyOtp({ email, token: token.trim(), type })
    if (error) throw new Error('验证码不正确或已过期，请检查后重试，或重新发送。')
    const user = await currentUser()
    if (!user?.verifiedCampus) throw new Error('邮箱尚未验证完成，请按邮件提示完成验证。')
    return user
  }
  async function signOut() {
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) throw new Error('退出失败，请检查网络后重试。')
  }
  return { currentUser, sendCode, verifyCode, signOut }
}
