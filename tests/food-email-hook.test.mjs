import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmailHandler, mailTargets, smtpOptions } from '../supabase/functions/food-auth-email/handler.ts'
const payload = { user: { email: 'fixture@zju.edu.cn' }, email_data: { email_action_type: 'signup', token: '123456' } }
function setup({ event = payload, invalid = false, send, configured = true, deadline = 4000 } = {}) {
  const calls = [], logs = []
  let closed = 0
  const handler = createEmailHandler({
    env: (name) => configured ? ({ FOOD_EMAIL_HOOK_SECRET: 'test-signing-secret', FOOD_SMTP_USER: 'sender@zju.edu.cn', FOOD_SMTP_PASSWORD: 'test-only' }[name]) : undefined,
    verify: () => { if (invalid) throw new Error('bad signature'); return event },
    transport: (options) => { calls.push(options); return { async sendMail(mail) { calls.push(mail); return send ? send(mail) : { accepted: [mail.to], rejected: [] } }, close() { closed++ } } },
    log: (value) => logs.push(value),
  }, deadline)
  return { handler, calls, logs, closed: () => closed }
}
const request = (method = 'POST', body = '{}') => new Request('https://fixture.invalid', { method, ...(method === 'POST' ? { body } : {}) })
test('SMTP uses explicit TLS on school port 994 and validates server certificate', () => {
  const options = smtpOptions('sender@zju.edu.cn', 'test-only')
  assert.equal(options.port, 994); assert.equal(options.secure, true)
  assert.equal(options.tls.rejectUnauthorized, true); assert.equal(options.tls.servername, options.host)
  assert.throws(() => smtpOptions('sender@zju.edu.cn\r\nBcc:evil@zju.edu.cn', 'test-only'))
})
test('unsupported method, missing secrets and invalid signature cannot send', async () => {
  for (const [options, method, status] of [[{}, 'GET', 405], [{ configured: false }, 'POST', 503], [{ invalid: true }, 'POST', 401]]) {
    const s = setup(options); assert.equal((await s.handler(request(method))).status, status); assert.equal(s.calls.length, 0)
  }
})
test('signup and login send Auth-generated OTP only, never trust user metadata', () => {
  for (const action of ['signup','magiclink','email','reauthentication']) assert.deepEqual(mailTargets({ ...payload, email_data: { ...payload.email_data, email_action_type: action } }), [{ to: 'fixture@zju.edu.cn', token: '123456' }])
})
test('anonymous binding sends sole token to new email, dual confirmation keeps both distinct', () => {
  assert.deepEqual(mailTargets({ user: { email: '', new_email: 'new@zju.edu.cn' }, email_data: { email_action_type: 'email_change', token: '123456', token_new: '', token_hash_new: '' } }), [{ to: 'new@zju.edu.cn', token: '123456' }])
  assert.deepEqual(mailTargets({ user: { email: 'old@zju.edu.cn', new_email: 'new@zju.edu.cn' }, email_data: { email_action_type: 'email_change', token: '123456', token_new: '654321', token_hash_new: 'current-hash' } }), [{ to: 'old@zju.edu.cn', token: '123456' }, { to: 'new@zju.edu.cn', token: '654321' }])
})
test('invalid domain, token injection and malformed dual confirmation cannot send', async () => {
  for (const event of [null, { ...payload, user: { email: 'x@zju.edu.cn.evil' } }, { ...payload, email_data: { email_action_type: 'signup', token: '<script>' } }, { user: { email: '', new_email: 'new@zju.edu.cn' }, email_data: { email_action_type: 'email_change', token: '123456', token_hash_new: 'current-hash' } }]) {
    const s = setup({ event }); assert.equal((await s.handler(request())).status, 400); assert.equal(s.calls.length, 0)
  }
})
test('success requires SMTP acceptance, response and logs contain no OTP or credentials', async () => {
  const s = setup(); const response = await s.handler(request())
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {})
  assert.equal(s.calls[1].to, 'fixture@zju.edu.cn')
  assert.match(s.calls[1].text, /123456/)
  assert.deepEqual(s.logs, [{ stage: 'smtp', code: 'ACCEPTED' }]); assert.equal(s.closed(), 1)
})
test('SMTP rejection and raw credential errors remain failures without leaking details', async () => {
  for (const send of [async () => ({ accepted: [], rejected: ['fixture@zju.edu.cn'] }), async () => { throw new Error('password test-only token 123456') }]) {
    const s = setup({ send }); const response = await s.handler(request())
    assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()) + JSON.stringify(s.logs), /test-only|123456|fixture@/)
    assert.equal(s.closed(), 1)
  }
})
test('SMTP hang is closed and returned before the Auth HTTP hook deadline', async () => {
  const s = setup({ send: () => new Promise(() => {}), deadline: 5 })
  assert.equal((await s.handler(request())).status, 503); assert.ok(s.closed() >= 1)
  assert.deepEqual(s.logs, [{ stage: 'smtp', code: 'SMTP_TIMEOUT' }])
})
test('security notifications do not fabricate OTP; unrelated flows fail explicitly', () => {
  const event = { ...payload, email_data: { email_action_type: 'password_changed_notification' } }
  assert.equal(mailTargets(event)[0].notice, '密码已变更'); assert.equal(mailTargets(event)[0].token, undefined)
  assert.throws(() => mailTargets({ ...payload, email_data: { email_action_type: 'invite', token: '123456' } }), /UNSUPPORTED_ACTION/)
})

test('oversized body is rejected before verification and SMTP', async () => {
  const s = setup()
  assert.equal((await s.handler(request('POST', 'x'.repeat(65537)))).status, 413)
  assert.equal(s.calls.length, 0)
})


test('accepts backend eight-digit OTP and rejects short or oversized codes', () => {
  assert.equal(mailTargets({ ...payload, email_data: { email_action_type: 'signup', token: '12345678' } })[0].token, '12345678')
  for (const token of ['12345', '12345678901', '1234567x']) assert.throws(() => mailTargets({ ...payload, email_data: { email_action_type: 'signup', token } }), /INVALID_PAYLOAD/)
})
