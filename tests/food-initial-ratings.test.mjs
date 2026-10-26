import assert from 'node:assert/strict'
import test from 'node:test'
import { createFoodApi, FoodServiceError } from '../src/lib/foodApi.ts'

// Local SDK boundary fixture; it cannot create identities or write ratings.
function fixture(reply = ({ ids }) => ({ data: ids.map((id) => ({ id, ratings: [{ rating: 4 }] })), error: null })) {
  const calls = []
  const forbidden = []
  const deny = (name) => () => { forbidden.push(name); throw new Error(`Unexpected ${name}`) }
  const client = {
    auth: { getUser: deny('getUser'), getSession: deny('getSession'), signInAnonymously: deny('signInAnonymously') },
    rpc: deny('rpc'),
    from(table) {
      const query = { table, select: '', ids: [], filters: [], orders: [], limits: [] }
      calls.push(query)
      const builder = {
        select(value) { query.select = value; return builder },
        in(column, ids) { assert.equal(column, 'id'); query.ids = ids; return builder },
        is(column, value) { query.filters.push({ column, value }); return builder },
        order(column, options) { query.orders.push({ column, options }); return builder },
        limit(count, options) { query.limits.push({ count, options }); return builder },
        insert: deny('insert'), update: deny('update'), delete: deny('delete'),
        then(resolve, reject) { return Promise.resolve().then(() => reply(query)).then(resolve, reject) },
      }
      return builder
    },
  }
  return { api: createFoodApi(client), calls, forbidden }
}

test('初始评分只读每道可见菜品的最早一条，不查询身份或写入评分', async () => {
  const { api, calls, forbidden } = fixture(() => ({ data: [
    { id: 'food-a', ratings: [{ rating: 5 }] },
    { id: 'food-b', ratings: [{ rating: 1 }] },
    { id: 'food-c', ratings: [] },
  ], error: null }))
  assert.deepEqual(await api.getInitialFoodRatings(['food-a', 'food-b', 'food-c', 'missing']), { 'food-a': 5, 'food-b': 1 })
  assert.deepEqual(calls, [{
    table: 'foods', select: 'id,ratings(rating)', ids: ['food-a', 'food-b', 'food-c', 'missing'],
    filters: [{ column: 'deleted_at', value: null }],
    orders: [
      { column: 'created_at', options: { referencedTable: 'ratings', ascending: true } },
      { column: 'id', options: { referencedTable: 'ratings', ascending: true } },
    ],
    limits: [{ count: 1, options: { referencedTable: 'ratings' } }, { count: 4, options: undefined }],
  }])
  assert.deepEqual(forbidden, [])
})

test('初始评分空输入不发请求，重复ID去重后分成每批最多100道', async () => {
  const { api, calls, forbidden } = fixture()
  assert.deepEqual(await api.getInitialFoodRatings([]), {})
  assert.equal(calls.length, 0)
  const ids = Array.from({ length: 205 }, (_, i) => `food-${i}`)
  const result = await api.getInitialFoodRatings([...ids, ...ids])
  assert.deepEqual(Object.keys(result), ids)
  assert.deepEqual(calls.map((query) => query.ids.length), [100, 100, 5])
  assert.deepEqual(calls.flatMap((query) => query.ids), ids)
  assert.deepEqual(forbidden, [])
})

for (const [name, response] of [
  ['服务错误', () => ({ data: null, error: { code: '42501' } })],
  ['网络异常', () => { throw new TypeError('offline') }],
  ['非数组数据', () => ({ data: {}, error: null })],
  ['缺少数据', () => ({ data: null, error: null })],
  ['非记录', () => ({ data: [null], error: null })],
  ['非请求菜品', () => ({ data: [{ id: 'another', ratings: [{ rating: 4 }] }], error: null })],
  ['重复父记录', () => ({ data: [{ id: 'food-a', ratings: [] }, { id: 'food-a', ratings: [] }], error: null })],
  ['评分非数组', () => ({ data: [{ id: 'food-a', ratings: null }], error: null })],
  ['超过一条初始评分', () => ({ data: [{ id: 'food-a', ratings: [{ rating: 4 }, { rating: 5 }] }], error: null })],
  ...[null, {}, '4', 0, 6, 3.5, Number.NaN].map((rating, i) => [`无效星级${i}`, () => ({ data: [{ id: 'food-a', ratings: [{ rating }] }], error: null })]),
]) {
  test(`初始评分${name}明确失败，不冒用当前均分或生成缺失初评`, async () => {
    const { api, forbidden } = fixture(response)
    await assert.rejects(api.getInitialFoodRatings(['food-a']), (error) => error instanceof FoodServiceError
      && error.code === 'LOAD_FAILED' && error.message === '初始评分暂时无法读取，请重试。')
    assert.deepEqual(forbidden, [])
  })
}

test('后续分块请求失败时不返回前一批的部分初评结果', async () => {
  const { api, forbidden } = fixture(({ ids }) => ids[0] === 'food-100'
    ? { data: null, error: { message: 'offline' } }
    : { data: ids.map((id) => ({ id, ratings: [{ rating: 3 }] })), error: null })
  await assert.rejects(api.getInitialFoodRatings(Array.from({ length: 101 }, (_, i) => `food-${i}`)), FoodServiceError)
  assert.deepEqual(forbidden, [])
})
