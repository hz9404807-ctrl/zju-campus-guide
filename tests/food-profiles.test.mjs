import test from 'node:test'
import assert from 'node:assert/strict'
import { createFoodProfilesApi, preferredProfile, profileStorageKey, validProfileName } from '../src/lib/foodProfiles.ts'
const USER = '10000000-0000-4000-8000-000000000001'
const FIRST = '20000000-0000-4000-8000-000000000001'
const SECOND = '20000000-0000-4000-8000-000000000002'
const rows = [{ id: FIRST, slot: 1, name: '默认档案' }, { id: SECOND, slot: 2, name: '食堂探索' }]
function setup({ user = { id: USER, email: 'fixture@zju.edu.cn', is_anonymous: false, email_confirmed_at: '2026-10-13T00:00:00Z' }, data = rows, error = null, rpcError = null } = {}) {
  const calls = []
  const client = {
    auth: { async getUser() { return { data: { user }, error: null } } },
    async rpc(name, params) { calls.push([name, params]); return { data: name === 'ensure_default_food_profile' ? FIRST : SECOND, error: rpcError } },
    from(table) {
      const call = { table }; calls.push(call)
      const query = { select(value) { call.select = value; return query }, eq(column, value) { call.filter = [column,value]; return query }, async order() { return { data, error } } }
      return query
    },
  }
  return { api: createFoodProfilesApi(client), calls }
}
test('profile name counts Unicode characters and rejects blank, long or control characters', () => {
  assert.equal(validProfileName(' 食堂探索 '), '食堂探索')
  assert.equal(validProfileName('🍚'.repeat(24)), '🍚'.repeat(24))
  for (const name of ['', '   ', '🍚'.repeat(25), 'a\nb', '\tname', 'name\n']) assert.equal(validProfileName(name), null)
})
test('saved profile cannot select another email profile or fabricate a local profile', () => {
  assert.equal(preferredProfile(rows, SECOND)?.id, SECOND)
  assert.equal(preferredProfile(rows, 'foreign-profile')?.id, FIRST)
  assert.equal(preferredProfile([], SECOND), null)
  assert.notEqual(profileStorageKey(USER), profileStorageKey(SECOND))
})
test('profiles load only after default assignment and query actual owner rows', async () => {
  const { api, calls } = setup()
  assert.deepEqual(await api.loadProfiles(USER), rows)
  assert.equal(calls[0][0], 'ensure_default_food_profile')
  assert.equal(calls[1].table, 'food_profiles'); assert.deepEqual(calls[1].filter, ['user_id', USER])
})
test('anonymous, unverified and changed accounts cannot initialize or create profiles', async () => {
  for (const user of [
    { id: USER, is_anonymous: true },
    { id: USER, is_anonymous: false, email: 'fixture@zju.edu.cn' },
    { id: SECOND, is_anonymous: false, email: 'fixture@zju.edu.cn', email_confirmed_at: '2026-10-13T00:00:00Z' },
  ]) {
    const { api, calls } = setup({ user })
    await assert.rejects(api.loadProfiles(USER)); await assert.rejects(api.createProfile('尝试创建', USER))
    assert.equal(calls.length, 0)
  }
})
test('profile creation binds the expected login UID without assigning an owner or choosing a slot', async () => {
  const { api, calls } = setup()
  assert.equal(await api.createProfile(' 食堂探索 ', USER), SECOND)
  assert.deepEqual(calls, [['create_food_profile', { p_name: '食堂探索', p_expected_user: USER }]])
})
test('capacity, duplicate names and unapplied migration give actionable errors', async () => {
  for (const [code, expected] of [['P0001','PROFILE_LIMIT'], ['23505','PROFILE_NAME_EXISTS'], ['PGRST202','NOT_READY']]) {
    await assert.rejects(setup({ rpcError: { code } }).api.createProfile('食堂探索', USER), (error) => error.code === expected)
  }
})
test('invalid profile list fails without exposing fabricated selections', async () => {
  for (const data of [[], [...rows, rows[0]], [{ ...rows[0], slot: 6 }], [{ ...rows[0], id: 'not-uuid' }], [rows[1]]]) await assert.rejects(setup({ data }).api.loadProfiles(USER), (error) => error.code === 'PROFILE_FAILED')
})
test('invalid name does not send a mutation', async () => {
  const { api, calls } = setup()
  await assert.rejects(api.createProfile('bad\nname', USER), (error) => error.code === 'INVALID_PROFILE_NAME')
  assert.equal(calls.length, 0)
})
