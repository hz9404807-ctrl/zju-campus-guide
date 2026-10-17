import assert from 'node:assert/strict'
import test from 'node:test'
import { createFoodApi, FoodServiceError } from '../src/lib/foodApi.ts'

// SDK contract tests; database authorization is exercised separately by test:db.
const USER_ID = '8cf0349e-a303-44ea-84b1-313d3711d41a'
const OTHER_USER_ID = 'cff431db-c858-4f08-ab6d-e5d73ee02fb6'
const FOOD_ID = '4507f396-0fbb-4fa7-81a1-001e951588b8'
const REMOVED_FOOD_ID = '5d6a5e63-ae21-471d-ab68-227bf7ee7472'
const USER = { id: USER_ID, email: 'fixture@zju.edu.cn', email_confirmed_at: '2026-10-13T00:00:00Z', is_anonymous: false }
const RATING = { food_id: FOOD_ID, rating: 4, created_at: '2026-10-17T02:30:00Z', food_name: '测试菜品', food_location: '测试地点', food_image_url: null }
const FOOD = { id: FOOD_ID, name: '测试菜品', location: '测试地点', area: 'campus', category: '饭类', price: null, image_url: null, description: '', tags: [], average_rating: 4, rating_count: 1, created_by: USER_ID, deleted_at: null }

function makeClient(options = {}) {
  const calls = { getUser: 0, rpc: [], queries: [], anonymous: 0 }
  let user = Object.hasOwn(options, 'user') ? options.user : USER
  const client = {
    auth: {
      async getUser() {
        calls.getUser += 1
        if (options.getUser) return options.getUser(calls.getUser)
        return { data: { user }, error: null }
      },
      async signInAnonymously() { calls.anonymous += 1; throw new Error('Personal reads must not create anonymous users.') },
    },
    async rpc(...args) {
      calls.rpc.push(args)
      return typeof options.rpc === 'function' ? options.rpc() : options.rpc ?? { data: [RATING], error: null }
    },
    from(table) {
      const query = { table, columns: '', filters: [], order: null }
      calls.queries.push(query)
      const builder = {
        select(columns) { query.columns = columns; return builder },
        eq(column, value) { query.filters.push([column, value]); return builder },
        async order(column, direction) {
          query.order = { column, ...direction }
          return typeof options.foods === 'function' ? options.foods() : options.foods ?? { data: [FOOD], error: null }
        },
      }
      return builder
    },
  }
  return { api: createFoodApi(client), calls, switchUser(next) { user = next } }
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => error instanceof FoodServiceError && error.code === code)
}

test('我的评分只调用当前身份RPC，不接受外部用户ID或读取所有评分', async () => {
  const { api, calls } = makeClient()
  assert.deepEqual(await api.myRatings(OTHER_USER_ID), [{
    food_id: FOOD_ID, rating: 4, created_at: RATING.created_at,
    food: { id: FOOD_ID, name: RATING.food_name, location: RATING.food_location, image_url: null },
  }])
  assert.deepEqual(calls.rpc, [['list_my_food_ratings']])
  assert.deepEqual(calls.queries, [])
  assert.equal(calls.getUser, 2)
  assert.equal(calls.anonymous, 0)
})

test('已撤下菜品仅保留本人评分历史，不显示被撤下的内容', async () => {
  const removed = { ...RATING, food_id: REMOVED_FOOD_ID, food_name: null, food_location: null, food_image_url: null }
  const { api } = makeClient({ rpc: { data: [removed], error: null } })
  assert.deepEqual(await api.myRatings(), [{ food_id: REMOVED_FOOD_ID, rating: 4, created_at: RATING.created_at, food: null }])
})

test('我的评分无记录时返回真实空列表，仍核对当前身份', async () => {
  const { api, calls } = makeClient({ rpc: { data: [], error: null } })
  assert.deepEqual(await api.myRatings(), [])
  assert.equal(calls.getUser, 2)
})

for (const [label, user] of [
  ['未登录', null],
  ['匿名', { ...USER, is_anonymous: true }],
  ['非浙大邮箱', { ...USER, email: 'fixture@other.edu.cn' }],
  ['邮箱未验证', { ...USER, email_confirmed_at: undefined }],
]) {
  test(`${label}时不请求个人评分或个人发布`, async () => {
    const { api, calls } = makeClient({ user })
    await rejectsCode(api.myRatings(), 'LOGIN_REQUIRED')
    await rejectsCode(api.myFoods(), 'LOGIN_REQUIRED')
    assert.deepEqual(calls.rpc, [])
    assert.deepEqual(calls.queries, [])
    assert.equal(calls.anonymous, 0)
  })
}

for (const [label, getUser] of [
  ['服务报错', () => ({ data: { user: USER }, error: { message: 'unverified token' } })],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`验证身份${label}时拒绝读取个人数据`, async () => {
    const { api, calls } = makeClient({ getUser })
    await rejectsCode(api.myRatings(), 'AUTH_FAILED')
    assert.equal(calls.rpc.length, 0)
  })
}

for (const code of ['PGRST202', '42883']) {
  test(`评分接口尚未部署（${code}）时提示待接入，不伪装空记录`, async () => {
    const { api } = makeClient({ rpc: { data: null, error: { code } } })
    await rejectsCode(api.myRatings(), 'NOT_READY')
  })
}

test('服务端拒绝未验证身份时保留登录提示', async () => {
  const { api } = makeClient({ rpc: { data: null, error: { code: '42501' } } })
  await rejectsCode(api.myRatings(), 'LOGIN_REQUIRED')
})

for (const [label, rpc] of [
  ['服务报错', { data: [RATING], error: { code: 'XX000' } }],
  ['无数据响应', { data: null, error: null }],
  ['非列表响应', { data: RATING, error: null }],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`我的评分${label}时提供可重试失败，不回退示例数据`, async () => {
    const { api } = makeClient({ rpc })
    await rejectsCode(api.myRatings(), 'LOAD_FAILED')
  })
}

for (const [field, value] of [
  ['food_id', 'invalid'], ['rating', 0], ['rating', 6], ['rating', 1.5], ['rating', '4'],
  ['created_at', 'invalid-date'], ['food_name', null], ['food_location', ''], ['food_image_url', 123],
]) {
  test(`我的评分响应损坏（${field}=${value}）时拒绝展示`, async () => {
    const { api } = makeClient({ rpc: { data: [{ ...RATING, [field]: value }], error: null } })
    await rejectsCode(api.myRatings(), 'LOAD_FAILED')
  })
}

test('我的评分不接受重复菜品记录', async () => {
  const { api } = makeClient({ rpc: { data: [RATING, RATING], error: null } })
  await rejectsCode(api.myRatings(), 'LOAD_FAILED')
})

for (const method of ['myRatings', 'myFoods']) {
  test(`${method}请求期间切换账号，旧响应不能作为新账号的数据返回`, async () => {
    const gate = Promise.withResolvers()
    const context = makeClient({ [method === 'myRatings' ? 'rpc' : 'foods']: () => gate.promise })
    const pending = context.api[method]()
    await new Promise((resolve) => setImmediate(resolve))
    context.switchUser({ ...USER, id: OTHER_USER_ID, email: 'other-fixture@zju.edu.cn' })
    gate.resolve({ data: [method === 'myRatings' ? RATING : FOOD], error: null })
    await rejectsCode(pending, 'IDENTITY_CHANGED')
  })

  test(`${method}请求期间退出登录，旧响应不能返回`, async () => {
    const gate = Promise.withResolvers()
    const context = makeClient({ [method === 'myRatings' ? 'rpc' : 'foods']: () => gate.promise })
    const pending = context.api[method]()
    await new Promise((resolve) => setImmediate(resolve))
    context.switchUser(null)
    gate.resolve({ data: [method === 'myRatings' ? RATING : FOOD], error: null })
    await rejectsCode(pending, 'LOGIN_REQUIRED')
  })
}

test('我的发布保留服务端本人筛选并核对返回时的身份', async () => {
  const { api, calls } = makeClient()
  const [food] = await api.myFoods()
  assert.equal(food.id, FOOD_ID)
  assert.deepEqual(calls.queries, [{ table: 'food_summaries', columns: '*', filters: [['created_by', USER_ID]], order: { column: 'created_at', ascending: false } }])
  assert.equal(calls.getUser, 2)
})

test('我的发布网络异常提供统一可重试错误', async () => {
  const { api } = makeClient({ foods: () => { throw new Error('offline') } })
  await rejectsCode(api.myFoods(), 'LOAD_FAILED')
})

test('我的评分失败后可重新请求成功，不缓存先前失败结果', async () => {
  let attempt = 0
  const { api } = makeClient({ rpc: () => ++attempt === 1 ? { data: null, error: { message: 'offline' } } : { data: [RATING], error: null } })
  await rejectsCode(api.myRatings(), 'LOAD_FAILED')
  assert.equal((await api.myRatings())[0].food_id, FOOD_ID)
})
