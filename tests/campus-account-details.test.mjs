import test from 'node:test'
import assert from 'node:assert/strict'
import { createCampusAccountApi, validateCampusDetails, emptyCampusDetails } from '../src/lib/campusAccountDetails.ts'

// SDK-boundary fixtures only. SQL tests separately exercise database permissions.
const A = '90000000-0000-4000-8000-000000000001'
const B = '90000000-0000-4000-8000-000000000002'
const stamp = '2026-10-22T00:00:00.123Z'
const member = (id = A) => ({ id, email: 'fixture@zju.edu.cn', is_anonymous: false, email_confirmed_at: stamp })
const row = { user_id: A, gender: 'female', signature: '测试资料', campus: '紫金港', updated_at: stamp }
function setup({ users = [member()], data = [row], error = null, authError = null, throws = false } = {}) {
  const calls = []
  let userChecks = 0
  const client = {
    auth: { async getUser() { const user = users[Math.min(userChecks++, users.length - 1)]; return { data: { user }, error: authError } } },
    async rpc(name, params) { calls.push({ name, params }); if (throws) throw new Error('fixture offline'); return { data, error } },
  }
  return { api: createCampusAccountApi(client), calls, get checks() { return userChecks } }
}

test('optional account details allow clearing, known campuses and Unicode character boundaries', () => {
  assert.deepEqual(validateCampusDetails(emptyCampusDetails), emptyCampusDetails)
  assert.equal(validateCampusDetails({ ...emptyCampusDetails, signature: '🍚'.repeat(120) }).signature.length, 240)
  assert.equal(validateCampusDetails({ gender: 'other', signature: '  测试  ', campus: '海宁' }).signature, '测试')
  for (const input of [
    { ...emptyCampusDetails, gender: 'invented' }, { ...emptyCampusDetails, campus: '不存在' },
    { ...emptyCampusDetails, signature: '🍚'.repeat(121) }, { ...emptyCampusDetails, signature: '测试\n签名' },
    { ...emptyCampusDetails, signature: '测试\x00' }, { ...emptyCampusDetails, signature: '测试\x7f' },
    { ...emptyCampusDetails, signature: '测试\u0085' }, { ...emptyCampusDetails, signature: '测试\u009f' },
    { ...emptyCampusDetails, signature: ' '.repeat(120) + '字' },
  ]) assert.throws(() => validateCampusDetails(input), { code: 'INVALID_DETAILS' })
})

test('load asks server for the expected current owner and confirms identity before returning', async () => {
  const fixture = setup()
  assert.deepEqual(await fixture.api.load(A), row)
  assert.deepEqual(fixture.calls, [{ name: 'get_my_campus_details', params: { p_expected_user_id: A } }])
  assert.equal(fixture.checks, 2)
})

test('no saved row stays null without an implicit write or browser persistence', async () => {
  const fixture = setup({ data: [] })
  assert.equal(await fixture.api.load(A), null)
  assert.equal(fixture.calls.length, 1)
  assert.equal(fixture.calls[0].name, 'get_my_campus_details')
})

test('save uses the same authenticated client, expected owner and optimistic server version', async () => {
  const fixture = setup()
  assert.deepEqual(await fixture.api.save({ gender: 'female', signature: ' 测试资料 ', campus: '紫金港' }, stamp, A), row)
  assert.deepEqual(fixture.calls[0], { name: 'save_my_campus_details', params: { p_expected_user_id: A, p_gender: 'female', p_signature: '测试资料', p_campus: '紫金港', p_expected_updated_at: stamp } })
  assert.equal(fixture.checks, 2)
  await fixture.api.save(emptyCampusDetails, null, A)
  assert.equal(fixture.calls[1].params.p_expected_updated_at, null)
})

test('guest, unverified, foreign-domain and other current accounts cannot query or save details', async () => {
  for (const user of [null, { ...member(), is_anonymous: true }, { ...member(), email_confirmed_at: undefined }, { ...member(), email: 'fixture@example.invalid' }, member(B)]) {
    const fixture = setup({ users: [user] })
    await assert.rejects(fixture.api.load(A))
    await assert.rejects(fixture.api.save(emptyCampusDetails, null, A))
    assert.equal(fixture.calls.length, 0)
  }
})

test('account switches while a read or save is in flight discard the old account result', async () => {
  for (const action of ['load', 'save']) {
    const fixture = setup({ users: [member(), member(B)] })
    await assert.rejects(action === 'load' ? fixture.api.load(A) : fixture.api.save(emptyCampusDetails, null, A), { code: 'IDENTITY_CHANGED' })
    assert.equal(fixture.calls.length, 1)
  }
})

test('logout or failed verification after the RPC cannot display a successful save', async () => {
  const fixture = setup({ users: [member(), null] })
  await assert.rejects(fixture.api.save(emptyCampusDetails, null, A), { code: 'LOGIN_REQUIRED' })
})

test('unapplied migration, version conflict and permissions receive distinct actionable feedback', async () => {
  for (const [code, expected] of [['PGRST202', 'NOT_READY'], ['42883', 'NOT_READY'], ['42P01', 'NOT_READY'], ['40001', 'EDIT_CONFLICT'], ['42501', 'LOGIN_REQUIRED'], ['23514', 'INVALID_DETAILS'], ['503', 'DETAILS_FAILED']]) {
    await assert.rejects(setup({ error: { code } }).api.save(emptyCampusDetails, null, A), { code: expected })
  }
})

test('invalid or foreign returned rows never populate the private interface', async () => {
  for (const data of [null, row, [row, row], [{ ...row, user_id: B }], [{ ...row, gender: 'bad' }], [{ ...row, campus: 'bad' }], [{ ...row, signature: null }], [{ ...row, updated_at: 'bad' }]]) {
    await assert.rejects(setup({ data }).api.load(A))
  }
})

test('network errors and empty mutation responses never report saved', async () => {
  await assert.rejects(setup({ throws: true }).api.save(emptyCampusDetails, null, A), { code: 'DETAILS_FAILED' })
  await assert.rejects(setup({ data: [] }).api.save(emptyCampusDetails, null, A), { code: 'DETAILS_FAILED' })
  await assert.rejects(setup({ authError: new Error('fixture') }).api.load(A), { code: 'AUTH_FAILED' })
})

test('invalid input or version fails before any RPC', async () => {
  const fixture = setup()
  await assert.rejects(fixture.api.save({ ...emptyCampusDetails, signature: 'x'.repeat(121) }, null, A), { code: 'INVALID_DETAILS' })
  await assert.rejects(fixture.api.save(emptyCampusDetails, 'invalid-date', A), { code: 'INVALID_DETAILS' })
  assert.equal(fixture.calls.length, 0)
})

test('optimistic timestamp retains server microseconds rather than round-tripping through Date', async () => {
  const original = '2026-10-22T00:00:00.123456+00:00'
  const fixture = setup({ data: [{ ...row, updated_at: original }] })
  const loaded = await fixture.api.load(A)
  await fixture.api.save(emptyCampusDetails, loaded.updated_at, A)
  assert.equal(fixture.calls[1].params.p_expected_updated_at, original)
})
