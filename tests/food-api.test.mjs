import assert from 'node:assert/strict'
import test from 'node:test'
import { createFoodApi, FoodServiceError } from '../src/lib/foodApi.ts'

// This is an SDK boundary test double. It performs no network requests and is
// deliberately separate from the PostgreSQL/RLS tests in this project.
const USER_ID = '8cf0349e-a303-44ea-84b1-313d3711d41a'
const FOOD_ID = '4507f396-0fbb-4fa7-81a1-001e951588b8'
const SESSION = { user: { id: USER_ID } }
const FOOD_ROW = {
  id: FOOD_ID,
  name: '测试菜品',
  location: '测试地点',
  area: 'campus',
  category: '饭类',
  price: '12.50',
  image_url: null,
  description: '测试接口映射',
  tags: ['清淡', '分量足'],
  average_rating: '4.25',
  rating_count: '4',
}
const PUBLISH_INPUT = {
  name: '测试菜品',
  location: '测试地点',
  area: 'campus',
  category: '饭类',
  price: 12.5,
  description: '测试发布',
  tags: ['清淡'],
  rating: 4,
}

function response(configured, fallback, argument) {
  if (typeof configured === 'function') return configured(argument)
  return configured === undefined ? fallback : configured
}

function makeClient(options = {}) {
  const calls = { getSession: 0, signInAnonymously: 0, queries: [], inserts: [], uploads: [], publicUrls: [], rpc: [] }
  const client = {
    auth: {
      async getSession() {
        calls.getSession += 1
        const session = Object.hasOwn(options, 'session') ? options.session : SESSION
        return response(options.getSession, { data: { session }, error: null })
      },
      async signInAnonymously() {
        calls.signInAnonymously += 1
        return response(options.signInAnonymously, { data: { user: { id: USER_ID } }, error: null })
      },
    },
    from(table) {
      const query = { table, columns: null, filters: [], order: null }
      calls.queries.push(query)
      const builder = {
        select(columns) { query.columns = columns; return builder },
        eq(column, value) { query.filters.push([column, value]); return builder },
        async order(column, ordering) {
          query.order = { column, ...ordering }
          return response(options.listResponse, { data: [FOOD_ROW], error: null }, query)
        },
        async maybeSingle() {
          const configured = table === 'ratings' ? options.ratingResponse : options.foodResponse
          const fallback = table === 'ratings' ? { data: { rating: 4 }, error: null } : { data: FOOD_ROW, error: null }
          return response(configured, fallback, query)
        },
        async insert(payload) {
          calls.inserts.push({ table, payload })
          return response(options.insertResponse, { data: null, error: null }, payload)
        },
      }
      return builder
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, file, uploadOptions) {
            const call = { bucket, path, file, options: uploadOptions }
            calls.uploads.push(call)
            return response(options.uploadResponse, { data: { path }, error: null }, call)
          },
          getPublicUrl(path) {
            calls.publicUrls.push({ bucket, path })
            return response(options.publicUrlResponse, { data: { publicUrl: `https://storage.test.invalid/${bucket}/${path}` } }, path)
          },
        }
      },
    },
    async rpc(name, parameters) {
      const call = { name, parameters }
      calls.rpc.push(call)
      return response(options.rpcResponse, { data: FOOD_ID, error: null }, call)
    },
  }
  return { api: createFoodApi(client), calls }
}

async function expectServiceError(promise, code) {
  await assert.rejects(promise, (error) => error instanceof FoodServiceError && error.code === code && error.name === 'FoodServiceError')
}

test('恢复已有匿名身份，不重新创建用户', async () => {
  const { api, calls } = makeClient()
  assert.equal(await api.ensureIdentity(), USER_ID)
  assert.equal(calls.signInAnonymously, 0)
})

test('并发操作共享一次匿名身份创建', async () => {
  const gate = Promise.withResolvers()
  const { api, calls } = makeClient({ getSession: () => gate.promise })
  const pending = [api.ensureIdentity(), api.ensureIdentity(), api.ensureIdentity()]
  gate.resolve({ data: { session: null }, error: null })
  assert.deepEqual(await Promise.all(pending), [USER_ID, USER_ID, USER_ID])
  assert.equal(calls.getSession, 1)
  assert.equal(calls.signInAnonymously, 1)
})

test('并发身份加载失败时，每个调用都得到明确的认证错误', async () => {
  const gate = Promise.withResolvers()
  const { api } = makeClient({ getSession: () => gate.promise })
  const pending = [api.ensureIdentity(), api.ensureIdentity()]
  gate.reject(new Error('simulated offline connection'))
  const outcomes = await Promise.allSettled(pending)
  for (const outcome of outcomes) {
    assert.equal(outcome.status, 'rejected')
    assert.ok(outcome.reason instanceof FoodServiceError)
    assert.equal(outcome.reason.code, 'AUTH_FAILED')
  }
})

test('无图片发布通过单次事务接口提交菜品和首次评分', async () => {
  const { api, calls } = makeClient()
  assert.equal(await api.publishFood(PUBLISH_INPUT, null), FOOD_ID)
  assert.deepEqual(calls.rpc, [{
    name: 'create_food_with_rating',
    parameters: {
      p_name: '测试菜品', p_location: '测试地点', p_area: 'campus', p_category: '饭类',
      p_price: 12.5, p_image_url: null, p_description: '测试发布', p_tags: ['清淡'], p_rating: 4,
    },
  }])
  assert.equal(calls.uploads.length, 0)
  assert.equal(calls.queries.length, 0)
  assert.equal(calls.inserts.length, 0)
})

for (const [label, data] of [
  ['空值', null], ['未定义', undefined], ['对象', { id: FOOD_ID }], ['数组', [FOOD_ID]],
  ['数字', 123], ['空字符串', ''], ['非 UUID 字符串', 'not-a-food-id'],
]) {
  test(`发布响应的菜品编号是${label}时不能显示成功`, async () => {
    const { api } = makeClient({ rpcResponse: { data, error: null } })
    await expectServiceError(api.publishFood(PUBLISH_INPUT, null), 'PUBLISH_FAILED')
  })
}

test('身份恢复的服务错误不会被吞掉或触发后续数据请求', async () => {
  const { api, calls } = makeClient({ getSession: { data: { session: null }, error: { message: 'session unavailable' } } })
  await expectServiceError(api.listFoods(), 'AUTH_FAILED')
  assert.equal(calls.signInAnonymously, 0)
  assert.equal(calls.queries.length, 0)
})

test('创建匿名用户返回错误时明确失败', async () => {
  const { api } = makeClient({ session: null, signInAnonymously: { data: { user: { id: USER_ID } }, error: { message: 'anonymous auth disabled' } } })
  await expectServiceError(api.ensureIdentity(), 'AUTH_FAILED')
})

test('创建匿名用户未返回用户时明确失败', async () => {
  const { api } = makeClient({ session: null, signInAnonymously: { data: { user: null }, error: null } })
  await expectServiceError(api.ensureIdentity(), 'AUTH_FAILED')
})

test('创建匿名身份遇到网络异常时返回认证错误', async () => {
  const { api } = makeClient({ session: null, signInAnonymously: () => { throw new Error('offline') } })
  await expectServiceError(api.ensureIdentity(), 'AUTH_FAILED')
})

test('身份请求失败后能重试，不一直复用已失败的请求', async () => {
  let attempts = 0
  const { api, calls } = makeClient({ getSession: () => {
    attempts += 1
    return attempts === 1 ? { data: { session: null }, error: { message: 'offline' } } : { data: { session: SESSION }, error: null }
  } })
  await expectServiceError(api.ensureIdentity(), 'AUTH_FAILED')
  assert.equal(await api.ensureIdentity(), USER_ID)
  assert.equal(calls.getSession, 2)
})

test('共享统计视图映射数字字符串，真实菜品不会标为示例', async () => {
  const { api, calls } = makeClient()
  assert.deepEqual(await api.listFoods(), [{
    id: FOOD_ID, name: '测试菜品', location: '测试地点', area: 'campus', category: '饭类',
    price: 12.5, image_url: null, description: '测试接口映射', tags: ['清淡', '分量足'],
    average_rating: 4.25, rating_count: 4, isExample: false,
  }])
  assert.deepEqual(calls.queries, [{ table: 'food_summaries', columns: '*', filters: [], order: { column: 'created_at', ascending: false } }])
})

test('零人评分时保留空平均分，空可选字段使用正确默认值', async () => {
  const row = { ...FOOD_ROW, price: null, average_rating: null, rating_count: '0', description: null, tags: null }
  const { api } = makeClient({ listResponse: { data: [row], error: null } })
  const [food] = await api.listFoods()
  assert.equal(food.price, null)
  assert.equal(food.average_rating, null)
  assert.equal(food.rating_count, 0)
  assert.equal(food.image_url, null)
  assert.equal(food.description, '')
  assert.deepEqual(food.tags, [])
})

test('价格零元与一人满分不会被当成空统计', async () => {
  const row = { ...FOOD_ROW, price: '0', average_rating: '5', rating_count: '1', tags: ['清淡', null, 123] }
  const { api } = makeClient({ listResponse: { data: [row], error: null } })
  const [food] = await api.listFoods()
  assert.equal(food.price, 0)
  assert.equal(food.average_rating, 5)
  assert.equal(food.rating_count, 1)
  assert.deepEqual(food.tags, ['清淡'])
})

test('共享菜品列表为空时返回空列表，不回退成演示菜品', async () => {
  const { api } = makeClient({ listResponse: { data: [], error: null } })
  assert.deepEqual(await api.listFoods(), [])
})

for (const [label, configured] of [
  ['服务返回错误', { data: [FOOD_ROW], error: { message: 'read failed' } }],
  ['未返回数据', { data: null, error: null }],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`共享菜品列表${label}时明确失败，不返回示例`, async () => {
    const { api } = makeClient({ listResponse: configured })
    await expectServiceError(api.listFoods(), 'LOAD_FAILED')
  })
}

for (const [field, value, label] of [
  ['id', null, '空编号'], ['name', 123, '非文本名称'], ['location', null, '空地点'],
  ['area', 'unknown', '未知范围'], ['category', null, '空分类'],
  ['price', '-1', '负价格'], ['price', 'NaN', '异常价格'], ['price', undefined, '缺失价格'],
  ['average_rating', '0', '零星平均分'], ['average_rating', '5.1', '超过五星平均分'],
  ['average_rating', Infinity, '无限平均分'], ['rating_count', '-1', '负评分人数'],
  ['rating_count', '1.2', '非整数评分人数'], ['rating_count', Number.MAX_SAFE_INTEGER + 1, '不安全评分人数'],
]) {
  test(`共享菜品响应存在${label}时不展示损坏数据`, async () => {
    const { api } = makeClient({ listResponse: { data: [{ ...FOOD_ROW, [field]: value }], error: null } })
    await expectServiceError(api.listFoods(), 'LOAD_FAILED')
  })
}

test('详情按菜品编号读取统计视图', async () => {
  const { api, calls } = makeClient()
  const food = await api.getFood(FOOD_ID)
  assert.equal(food.id, FOOD_ID)
  assert.equal(food.average_rating, 4.25)
  assert.deepEqual(calls.queries, [{ table: 'food_summaries', columns: '*', filters: [['id', FOOD_ID]], order: null }])
})

test('未找到的菜品详情返回空值', async () => {
  const { api } = makeClient({ foodResponse: { data: null, error: null } })
  assert.equal(await api.getFood(FOOD_ID), null)
})

for (const [label, configured] of [
  ['服务错误', { data: null, error: { message: 'permission denied' } }],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`详情请求${label}时返回加载失败`, async () => {
    const { api } = makeClient({ foodResponse: configured })
    await expectServiceError(api.getFood(FOOD_ID), 'LOAD_FAILED')
  })
}

test('自己的评分查询同时限定菜品编号与当前认证用户', async () => {
  const { api, calls } = makeClient()
  assert.equal(await api.getMyRating(FOOD_ID), 4)
  assert.deepEqual(calls.queries, [{ table: 'ratings', columns: 'rating', filters: [['food_id', FOOD_ID], ['user_id', USER_ID]], order: null }])
})

test('尚未评分时返回空值', async () => {
  const { api } = makeClient({ ratingResponse: { data: null, error: null } })
  assert.equal(await api.getMyRating(FOOD_ID), null)
})

for (const [label, configured] of [
  ['服务错误', { data: null, error: { message: 'permission denied' } }],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`读取自己评分${label}时明确失败`, async () => {
    const { api } = makeClient({ ratingResponse: configured })
    await expectServiceError(api.getMyRating(FOOD_ID), 'LOAD_FAILED')
  })
}

for (const rating of [1, 2, 3, 4, 5]) {
  test(`提交 ${rating} 星评分时使用当前用户的身份`, async () => {
    const { api, calls } = makeClient()
    await api.rateFood(FOOD_ID, rating)
    assert.deepEqual(calls.inserts, [{ table: 'ratings', payload: { food_id: FOOD_ID, user_id: USER_ID, rating } }])
  })
}

for (const [label, rating] of [
  ['零', 0], ['负数', -1], ['超过五星', 6], ['小数', 2.5], ['NaN', NaN],
  ['无限大', Infinity], ['字符串', '5'], ['空值', null], ['未定义', undefined],
]) {
  test(`评分是${label}时在发送请求前拒绝`, async () => {
    const { api, calls } = makeClient()
    await expectServiceError(api.rateFood(FOOD_ID, rating), 'INVALID_RATING')
    assert.equal(calls.getSession, 0)
    assert.equal(calls.inserts.length, 0)
  })
}

test('数据库的重复评分约束转换为已评分提示', async () => {
  const { api } = makeClient({ insertResponse: { data: null, error: { code: '23505', message: 'duplicate user and food' } } })
  await expectServiceError(api.rateFood(FOOD_ID, 5), 'ALREADY_RATED')
})

for (const [label, configured] of [
  ['服务错误', { data: null, error: { code: '42501', message: 'permission denied' } }],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`提交评分${label}时明确失败`, async () => {
    const { api } = makeClient({ insertResponse: configured })
    await expectServiceError(api.rateFood(FOOD_ID, 4), 'RATING_FAILED')
  })
}

for (const [mime, extension] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]) {
  test(`${mime} 图片上传到本人目录，文件扩展名按 MIME 确定`, async () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'untrusted-filename.exe', { type: mime })
    const { api, calls } = makeClient()
    assert.equal(await api.publishFood(PUBLISH_INPUT, image), FOOD_ID)
    assert.equal(calls.uploads.length, 1)
    const [upload] = calls.uploads
    assert.equal(upload.bucket, 'food-images')
    assert.match(upload.path, new RegExp(`^${USER_ID}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.${extension}$`, 'i'))
    assert.equal(upload.file, image)
    assert.deepEqual(upload.options, { contentType: mime, upsert: false })
    assert.deepEqual(calls.publicUrls, [{ bucket: 'food-images', path: upload.path }])
    assert.equal(calls.rpc[0].parameters.p_image_url, `https://storage.test.invalid/food-images/${upload.path}`)
    assert.equal(calls.rpc[0].parameters.p_rating, 4)
    assert.equal(calls.inserts.length, 0)
  })
}

test('同名图片连续发布时各用新的路径，避免覆盖之前的图片', async () => {
  const image = new File(['bytes'], 'same-name.png', { type: 'image/png' })
  const { api, calls } = makeClient()
  await api.publishFood(PUBLISH_INPUT, image)
  await api.publishFood(PUBLISH_INPUT, image)
  assert.equal(calls.uploads.length, 2)
  assert.notEqual(calls.uploads[0].path, calls.uploads[1].path)
})

test('恰好 5 MB 的允许格式图片可以提交', async () => {
  const image = { type: 'image/png', size: 5 * 1024 * 1024 }
  const { api, calls } = makeClient()
  assert.equal(await api.publishFood(PUBLISH_INPUT, image), FOOD_ID)
  assert.equal(calls.uploads.length, 1)
})

for (const [label, image] of [
  ['空文件', { type: 'image/png', size: 0 }],
  ['超出 5 MB', { type: 'image/png', size: 5 * 1024 * 1024 + 1 }],
  ['不支持的 GIF', { type: 'image/gif', size: 3 }],
  ['非标准 JPG MIME', { type: 'image/jpg', size: 3 }],
  ['缺少 MIME', { type: '', size: 3 }],
]) {
  test(`图片${label}时在连接服务前拒绝发布`, async () => {
    const { api, calls } = makeClient()
    await expectServiceError(api.publishFood(PUBLISH_INPUT, image), 'INVALID_IMAGE')
    assert.equal(calls.getSession, 0)
    assert.equal(calls.uploads.length, 0)
    assert.equal(calls.rpc.length, 0)
  })
}

for (const [label, configured] of [
  ['服务错误', { data: null, error: { message: 'storage access denied' } }],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`图片上传${label}时不能继续创建菜品`, async () => {
    const image = new File(['bytes'], 'photo.png', { type: 'image/png' })
    const { api, calls } = makeClient({ uploadResponse: configured })
    await expectServiceError(api.publishFood(PUBLISH_INPUT, image), 'UPLOAD_FAILED')
    assert.equal(calls.publicUrls.length, 0)
    assert.equal(calls.rpc.length, 0)
  })
}

test('获取上传图片公开地址失败时不发布菜品', async () => {
  const image = new File(['bytes'], 'photo.png', { type: 'image/png' })
  const { api, calls } = makeClient({ publicUrlResponse: () => { throw new Error('public URL unavailable') } })
  await expectServiceError(api.publishFood(PUBLISH_INPUT, image), 'UPLOAD_FAILED')
  assert.equal(calls.rpc.length, 0)
})

test('发布未选分类时提交约定的其他分类', async () => {
  const { api, calls } = makeClient()
  await api.publishFood({ ...PUBLISH_INPUT, category: '' }, null)
  assert.equal(calls.rpc[0].parameters.p_category, '其他')
})

test('发布的首次评分无效时不上传图片或创建菜品', async () => {
  const image = new File(['bytes'], 'photo.png', { type: 'image/png' })
  const { api, calls } = makeClient()
  await expectServiceError(api.publishFood({ ...PUBLISH_INPUT, rating: 2.5 }, image), 'INVALID_RATING')
  assert.equal(calls.getSession, 0)
  assert.equal(calls.uploads.length, 0)
  assert.equal(calls.rpc.length, 0)
})

for (const [label, configured] of [
  ['服务错误', { data: FOOD_ID, error: { message: 'transaction rejected' } }],
  ['网络异常', () => { throw new Error('offline') }],
]) {
  test(`发布请求${label}时不能报告成功`, async () => {
    const { api } = makeClient({ rpcResponse: configured })
    await expectServiceError(api.publishFood(PUBLISH_INPUT, null), 'PUBLISH_FAILED')
  })
}

test('图片已上传但发布事务失败时仍报告发布失败', async () => {
  const image = new File(['bytes'], 'photo.png', { type: 'image/png' })
  const { api, calls } = makeClient({ rpcResponse: { data: null, error: { message: 'transaction rolled back' } } })
  await expectServiceError(api.publishFood(PUBLISH_INPUT, image), 'PUBLISH_FAILED')
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.rpc.length, 1)
})
