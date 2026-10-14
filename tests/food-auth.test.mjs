import test from 'node:test'
import assert from 'node:assert/strict'
import { campusEmail, foodUser, safeFoodReturn, createFoodAuth, FoodCodeDeliveryUnknown } from '../src/lib/foodAuth.ts'
const guest = { id: 'guest-id', is_anonymous: true }
const member = { id: 'guest-id', email: 'fixture@zju.edu.cn', is_anonymous: false, email_confirmed_at: '2026-10-13T00:00:00Z' }
function setup(user = guest, errors = {}) {
  const calls = []
  const client = { auth: {
    async getSession() { return { data: { session: user ? { user } : null }, error: null } },
    async getUser() { return { data: { user }, error: errors.getUser ?? null } },
    async updateUser(input) { calls.push(['bind',input]); return { data: { user }, error: errors.bind ?? null } },
    async signInWithOtp(input) { calls.push(['login',input]); return { error: errors.login ?? null } },
    async verifyOtp(input) { calls.push(['verify',input]); if (!errors.verify) user = member; return { error: errors.verify ?? null } },
    async signOut(input) { calls.push(['logout',input]); return { error: errors.logout ?? null } },
  } }
  return { auth: createFoodAuth(client), calls }
}
test('邮箱精确限定学校域名，拒绝伪后缀及多个@', () => {
  assert.equal(campusEmail(' FIXTURE@ZJU.EDU.CN '), 'fixture@zju.edu.cn')
  for (const email of ['x@stu.zju.edu.cn','x@zju.edu.cn.evil','x@zju.edu.cn@evil','x@example.com','x @zju.edu.cn','']) assert.equal(campusEmail(email), null)
})
test('学校成员必须已验证且为非匿名身份，不信任仅填写的邮箱', () => {
  assert.equal(foodUser(member).verifiedCampus, true)
  assert.equal(foodUser({ ...member, is_anonymous: true }).verifiedCampus, false)
  assert.equal(foodUser({ ...member, email_confirmed_at: undefined }).verifiedCampus, false)
  assert.equal(foodUser({ ...member, email: 'x@other.edu.cn' }).verifiedCampus, false)
})
test('返回地址保留办事上下文且不允许站外跳转', () => {
  assert.equal(safeFoodReturn('/food/abc/edit?area=campus'), '/food/abc/edit?area=campus')
  for (const url of ['https://evil.invalid','//evil.invalid','/food/../../about','/about','/foodish','/food/login?returnTo=evil']) assert.equal(safeFoodReturn(url), '/food')
})
test('绑定匿名身份使用邮箱变更验证，保留原身份，不另外创建账号', async () => {
  const { auth, calls } = setup()
  assert.equal(await auth.sendCode(member.email,'bind'), 'email_change')
  assert.deepEqual(calls, [['bind', { email: member.email }]])
  const result = await auth.verifyCode(member.email, '123456', 'email_change')
  assert.equal(result.id, guest.id)
  assert.equal(result.verifiedCampus, true)
})
test('已有账号登录不隐式注册，也不修改原匿名邮箱', async () => {
  const { auth, calls } = setup()
  assert.equal(await auth.sendCode(member.email, 'login'), 'email')
  assert.deepEqual(calls, [['login', { email: member.email, options: { shouldCreateUser: false } }]])
})
test('非学校邮箱或无效验证码在发请求前被拒绝', async () => {
  const { auth, calls } = setup()
  await assert.rejects(auth.sendCode('x@evil.invalid', 'bind'))
  await assert.rejects(auth.verifyCode(member.email, '123', 'email'))
  assert.equal(calls.length, 0)
})
test('发送失败和错误验证码不会显示已登录，邮箱占用说明不自动迁移', async () => {
  const { auth } = setup(guest, { bind: { message: 'Email already registered' }, verify: { message: 'expired' } })
  await assert.rejects(auth.sendCode(member.email, 'bind'), /旧匿名发布不会自动转移/)
  await assert.rejects(auth.verifyCode(member.email, '123456', 'email_change'), /不正确或已过期/)
  assert.equal((await auth.currentUser()).verifiedCampus, false)
})
test('退出仅清除当前设备会话，服务错误可见', async () => {
  const { auth, calls } = setup(member)
  await auth.signOut()
  assert.deepEqual(calls, [['logout', { scope: 'local' }]])
  await assert.rejects(setup(member, { logout: { message: 'offline' } }).auth.signOut(), /退出失败/)
})

test('service timeout preserves correct verification type without claiming email delivery', async () => {
  for (const [mode, errors, type] of [
    ['bind', { bind: { status: 504, code: 'request_timeout', message: 'context deadline exceeded' } }, 'email_change'],
    ['login', { login: { name: 'AuthRetryableFetchError', message: 'TimeoutError: signal timed out' } }, 'email'],
  ]) {
    const { auth } = setup(guest, errors)
    await assert.rejects(auth.sendCode(member.email, mode), (error) => {
      assert.ok(error instanceof FoodCodeDeliveryUnknown)
      assert.equal(error.type, type); assert.match(error.message, /尚未确认/)
      return true
    })
    assert.equal((await auth.currentUser()).verifiedCampus, false)
  }
})
test('rate limit and rejected sender do not masquerade as an uncertain timeout', async () => {
  for (const [error, pattern] of [
    [{ status: 429, code: 'over_email_send_rate_limit', message: 'limited' }, /过于频繁/],
    [{ status: 500, message: 'Error sending confirmation email' }, /邮件发送服务暂时失败/],
  ]) {
    await assert.rejects(setup(guest, { bind: error }).auth.sendCode(member.email, 'bind'), (value) => {
      assert.equal(value instanceof FoodCodeDeliveryUnknown, false); assert.match(value.message, pattern); return true
    })
  }
})


test('eight-digit code reaches Auth unchanged; short and oversized codes never reach Auth', async () => {
  const { auth, calls } = setup()
  await auth.verifyCode(member.email, '12345678', 'email')
  assert.equal(calls[0][1].token, '12345678')
  const invalid = setup()
  for (const token of ['12345', '12345678901', '1234567x']) await assert.rejects(invalid.auth.verifyCode(member.email, token, 'email'))
  assert.equal(invalid.calls.length, 0)
})
