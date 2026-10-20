import assert from 'node:assert/strict'
import test from 'node:test'
import { createFavoritesApi } from '../src/lib/favoritesApi.ts'
import { FoodServiceError } from '../src/lib/foodApi.ts'

// SDK boundary doubles only: no network, actual identities or shared writes.
const A = 'a1000000-0000-4000-8000-000000000001'
const B = 'a1000000-0000-4000-8000-000000000002'
const FOOD = 'b1000000-0000-4000-8000-000000000001'
const verified = (id = A) => ({ id, email: 'favorite-fixture@zju.edu.cn', is_anonymous: false, email_confirmed_at: '2026-10-20T00:00:00Z' })
const row = { target_kind: 'guide', target_id: 'campus-card-replacement', context: { route: 'offline', campus: '紫金港' }, created_at: '2026-10-20T01:00:00Z' }

function fixture(options = {}) {
  const calls = { user: 0, rpc: [] }
  const client = {
    auth: { async getUser() {
      calls.user += 1
      if (options.getUser) return options.getUser(calls.user)
      return { data: { user: Object.hasOwn(options, 'user') ? options.user : verified() }, error: null }
    } },
    async rpc(name, params) {
      calls.rpc.push({ name, params })
      if (options.rpc) return options.rpc(name, params)
      return { data: name === 'list_my_campus_favorites' ? [row] : null, error: null }
    },
  }
  return { api: createFavoritesApi(client), calls }
}
async function rejects(promise, code) {
  await assert.rejects(promise, (error) => error instanceof FoodServiceError && error.code === code)
}

test('收藏列表使用零用户参数 RPC，服务端验证前后身份', async () => {
  const { api, calls } = fixture()
  assert.deepEqual(await api.listFavorites(), [row])
  assert.deepEqual(calls.rpc, [{ name: 'list_my_campus_favorites', params: undefined }])
  assert.equal(calls.user, 2)
})
test('收藏空列表保持真实空结果', async () => {
  const { api } = fixture({ rpc: () => ({ data: [], error: null }) })
  assert.deepEqual(await api.listFavorites(), [])
})
test('保存仅提交目标与允许的重访上下文，取消收藏无用户参数', async () => {
  const { api, calls } = fixture()
  await api.saveFavorite('guide', row.target_id, row.context)
  await api.removeFavorite('guide', row.target_id)
  assert.deepEqual(calls.rpc, [
    { name: 'save_my_campus_favorite', params: { p_target_kind: 'guide', p_target_id: row.target_id, p_context: row.context } },
    { name: 'remove_my_campus_favorite', params: { p_target_kind: 'guide', p_target_id: row.target_id } },
  ])
})
test('菜品 UUID 统一小写以匹配数据库唯一约束', async () => {
  const { api, calls } = fixture()
  await api.saveFavorite('food', FOOD.toUpperCase())
  assert.equal(calls.rpc[0].params.p_target_id, FOOD)
  assert.deepEqual(calls.rpc[0].params.p_context, {})
})
for (const [label, user] of [
  ['无用户', null], ['匿名', { id: A, is_anonymous: true }],
  ['伪造匿名验证信息', { ...verified(), is_anonymous: true }],
  ['未确认邮箱', { ...verified(), email_confirmed_at: undefined }],
  ['外校邮箱', { ...verified(), email: 'test@example.invalid' }],
]) {
  test(`${label}不能读取、保存或取消收藏`, async () => {
    const { api, calls } = fixture({ user })
    await rejects(api.listFavorites(), 'LOGIN_REQUIRED')
    await rejects(api.saveFavorite('guide', row.target_id), 'LOGIN_REQUIRED')
    await rejects(api.removeFavorite('guide', row.target_id), 'LOGIN_REQUIRED')
    assert.equal(calls.rpc.length, 0)
  })
}
for (const context of [
  { q: '私人问题' }, { returnTo: '//example.invalid' }, { token: 'private' }, { route: 'https://example.invalid' },
  { route: '../elsewhere' }, { route: 'x?token=private' }, { campus: '紫金港&code=123' }, { campus: 'x'.repeat(33) },
  { campus: null }, ['紫金港'], null,
]) {
  test(`拒绝不允许的收藏上下文 ${JSON.stringify(context)}`, async () => {
    const { api, calls } = fixture()
    await rejects(api.saveFavorite('guide', row.target_id, context), 'INVALID_FAVORITE')
    assert.equal(calls.rpc.length, 0)
  })
}
test('route 只适用于指南，官方入口和菜品不能保存它', async () => {
  const { api, calls } = fixture()
  await rejects(api.saveFavorite('food', FOOD, { route: 'offline' }), 'INVALID_FAVORITE')
  await rejects(api.saveFavorite('website', 'website-123', { route: 'offline' }), 'INVALID_FAVORITE')
  assert.equal(calls.rpc.length, 0)
})
for (const [kind, id] of [['account', 'account-1'], ['guide', '//evil.invalid'], ['food', 'not-a-uuid'], ['guide', 'a'.repeat(101)], ['website', 'website-1?code=2']]) {
  test(`拒绝异常目标 ${kind}/${id}`, async () => {
    const { api, calls } = fixture()
    await rejects(api.saveFavorite(kind, id), 'INVALID_FAVORITE')
    await rejects(api.removeFavorite(kind, id), 'INVALID_FAVORITE')
    assert.equal(calls.rpc.length, 0)
  })
}
for (const response of [null, {}, [null], [{ ...row, target_id: '//invalid' }], [{ ...row, context: { q: 'secret' } }], [{ ...row, created_at: 'invalid-date' }], [row, row]]) {
  test(`列表响应无效时不能冒充已加载 ${JSON.stringify(response)}`, async () => {
    const { api } = fixture({ rpc: () => ({ data: response, error: null }) })
    await rejects(api.listFavorites(), 'LOAD_FAILED')
  })
}
for (const method of ['listFavorites', 'saveFavorite', 'removeFavorite']) {
  test(`${method} 请求途中换号，拒绝旧账号响应`, async () => {
    const { api } = fixture({ getUser: (count) => ({ data: { user: verified(count === 1 ? A : B) }, error: null }) })
    await rejects(api[method]('guide', row.target_id), 'IDENTITY_CHANGED')
  })
}
for (const [code, expected] of [['PGRST202', 'NOT_READY'], ['42883', 'NOT_READY'], ['42501', 'LOGIN_REQUIRED'], ['P0002', 'TARGET_UNAVAILABLE'], ['23514', 'INVALID_FAVORITE'], ['503', 'SAVE_FAILED']]) {
  test(`保存错误 ${code} 保留明确失败状态`, async () => {
    const { api } = fixture({ rpc: () => ({ data: null, error: { code } }) })
    await rejects(api.saveFavorite('food', FOOD), expected)
  })
}
test('Auth 网络失败不发送收藏查询或写入', async () => {
  const { api, calls } = fixture({ getUser: () => { throw new Error('offline') } })
  await rejects(api.listFavorites(), 'AUTH_FAILED')
  await rejects(api.saveFavorite('guide', row.target_id), 'AUTH_FAILED')
  assert.equal(calls.rpc.length, 0)
})
test('请求失败不返回空列表或假成功', async () => {
  const { api } = fixture({ rpc: () => { throw new Error('offline') } })
  await rejects(api.listFavorites(), 'LOAD_FAILED')
  await rejects(api.saveFavorite('guide', row.target_id), 'SAVE_FAILED')
  await rejects(api.removeFavorite('guide', row.target_id), 'SAVE_FAILED')
})
