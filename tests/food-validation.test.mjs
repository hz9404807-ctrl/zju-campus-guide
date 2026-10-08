import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findSimilarFoods,
  parseFoodTags,
  toFoodPublishInput,
  validateFoodImage,
  validateFoodPublishDraft,
} from '../src/lib/foodValidation.ts'

function draft(overrides = {}) {
  return {
    name: '测试菜品', location: '测试地点', area: 'campus', category: '饭类',
    price: '', description: '', tags: '', rating: 4,
    ...overrides,
  }
}

function assertOnlyError(field, overrides, image = null) {
  const errors = validateFoodPublishDraft(draft(overrides), image)
  assert.deepEqual(Object.keys(errors), [field])
  assert.equal(typeof errors[field], 'string')
  assert.ok(errors[field].length > 0)
}

test('必填字段有效时，所有可选字段都可留空', () => {
  assert.deepEqual(validateFoodPublishDraft(draft(), null), {})
})

test('提交时清理名称、地点、介绍和标签的前后空白', () => {
  const input = draft({ name: '  测试菜品\n', location: '\n测试地点  ', price: '  .50 ', description: '  测试介绍\n', tags: ' 清淡， 清淡、 分量足 ', category: '' })
  const before = structuredClone(input)
  assert.deepEqual(toFoodPublishInput(input), {
    name: '测试菜品', location: '测试地点', area: 'campus', category: '其他',
    price: 0.5, description: '测试介绍', tags: ['清淡', '分量足'], rating: 4,
  })
  assert.deepEqual(input, before)
})

test('价格只含空白时转成空值，不会显示零元', () => {
  assert.equal(toFoodPublishInput(draft({ price: '  \n  ' })).price, null)
})

test('价格零元明确保留数字零', () => {
  assert.equal(toFoodPublishInput(draft({ price: ' 0.00 ' })).price, 0)
})

test('短评标签支持中英文逗号、顿号和换行，并按首次顺序去重', () => {
  assert.deepEqual(parseFoodTags(' 清淡, 分量足，清淡、热乎\n分量足， ,\n'), ['清淡', '分量足', '热乎'])
})

test('短评标签只含分隔符与空白时没有标签', () => {
  assert.deepEqual(parseFoodTags(' ， , 、 \n '), [])
})

for (const [field, label, value] of [['name', '名称为空', ''], ['name', '名称只有空白', ' \n '], ['location', '地点为空', ''], ['location', '地点只有空白', '\t  ']]) {
  test(`${label}时提示对应必填字段`, () => assertOnlyError(field, { [field]: value }))
}

for (const [field, limit, char, label] of [['name', 80, '🍜', '名称'], ['location', 120, '地', '地点'], ['description', 200, '介', '介绍']]) {
  test(`${label}恰好达到字数上限时允许提交`, () => {
    assert.deepEqual(validateFoodPublishDraft(draft({ [field]: char.repeat(limit) }), null), {})
  })
  test(`${label}超过字数上限时拒绝提交`, () => assertOnlyError(field, { [field]: char.repeat(limit + 1) }))
}

test('名称字数在清理空白后检查', () => {
  assert.deepEqual(validateFoodPublishDraft(draft({ name: `  ${'菜'.repeat(80)}  ` }), null), {})
})

for (const area of ['campus', 'off_campus']) {
  test(`${area} 是有效的美食范围`, () => assert.deepEqual(validateFoodPublishDraft(draft({ area }), null), {}))
}

test('未知美食范围不能提交', () => assertOnlyError('area', { area: 'unknown' }))

for (const category of ['', '饭类', '面类', '面食', '甜品', '饮品', '其他']) {
  test(`分类“${category || '留空'}”允许提交`, () => assert.deepEqual(validateFoodPublishDraft(draft({ category }), null), {}))
}

test('不在选择列表中的分类不能提交', () => assertOnlyError('category', { category: '不存在的分类' }))

for (const rating of [1, 2, 3, 4, 5]) {
  test(`${rating} 星可以作为发布者的首次评分`, () => assert.deepEqual(validateFoodPublishDraft(draft({ rating }), null), {}))
}

for (const [label, rating] of [['零星', 0], ['负星', -1], ['六星', 6], ['小数', 4.5], ['NaN', NaN], ['无限大', Infinity], ['数字字符串', '5']]) {
  test(`首次评分是${label}时提示选择整数星数`, () => assertOnlyError('rating', { rating }))
}

for (const price of ['', '  ', '0', '0.00', '.5', '.50', '12', '12.3', '12.30', '000.50', '99999.99']) {
  test(`价格“${price || '留空'}”满足可选的非负金额规则`, () => assert.deepEqual(validateFoodPublishDraft(draft({ price }), null), {}))
}

for (const [label, price] of [
  ['负数', '-1'], ['负零', '-0'], ['正号', '+1'], ['三位小数', '1.234'], ['缺少小数位', '1.'],
  ['指数形式', '1e2'], ['十六进制', '0x10'], ['无限大', 'Infinity'], ['NaN', 'NaN'],
  ['超过金额上限', '100000'], ['千位逗号', '1,000'], ['币种符号', '￥12'], ['数值溢出', '9'.repeat(400)],
]) {
  test(`价格是${label}时提示金额格式错误`, () => assertOnlyError('price', { price }))
}

test('标签数量恰好五个时允许提交', () => {
  assert.deepEqual(validateFoodPublishDraft(draft({ tags: '清淡,热乎,分量足,偏甜,微辣' }), null), {})
})

test('超过五个不同标签时拒绝提交', () => assertOnlyError('tags', { tags: '清淡,热乎,分量足,偏甜,微辣,偏咸' }))

test('重复标签去重后再检查数量', () => {
  assert.deepEqual(validateFoodPublishDraft(draft({ tags: '清淡,热乎,分量足,偏甜,微辣,清淡' }), null), {})
})

test('单个标签达到十二个 Unicode 字符时允许提交', () => {
  assert.deepEqual(validateFoodPublishDraft(draft({ tags: '🍜'.repeat(12) }), null), {})
})

test('单个标签超过十二个字时拒绝提交', () => assertOnlyError('tags', { tags: '菜'.repeat(13) }))

test('未选择图片时无需图片错误提示', () => assert.equal(validateFoodImage(null), undefined))

for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
  test(`${type} 图片大小恰好五 MB 时通过表单校验`, () => {
    const image = { type, size: 5 * 1024 * 1024 }
    assert.equal(validateFoodImage(image), undefined)
    assert.deepEqual(validateFoodPublishDraft(draft(), image), {})
  })
}

for (const [label, image] of [
  ['超过大小上限', { type: 'image/png', size: 5 * 1024 * 1024 + 1 }],
  ['空文件', { type: 'image/png', size: 0 }],
  ['GIF 格式', { type: 'image/gif', size: 3 }],
  ['错误 JPEG MIME', { type: 'image/jpg', size: 3 }],
  ['没有 MIME', { type: '', size: 3 }],
]) {
  test(`图片${label}时表单定位到图片字段`, () => {
    assert.equal(typeof validateFoodImage(image), 'string')
    assertOnlyError('image', {}, image)
  })
}

test('多个字段无效时一次返回全部对应的错误', () => {
  const errors = validateFoodPublishDraft(draft({ name: '', location: '', rating: 0, price: '-1' }), { type: 'image/gif', size: 3 })
  assert.deepEqual(Object.keys(errors).sort(), ['image', 'location', 'name', 'price', 'rating'])
})

function food(id, name, location) {
  return {
    id, name, location, area: 'campus', category: '饭类', price: null, image_url: null,
    description: '', tags: [], average_rating: null, rating_count: 0, isExample: false,
  }
}

test('相似菜品忽略全角字母、空白和地点括号差异', () => {
  const foods = [food('same', 'A·B饭', '测试店（南门）'), food('different', '汤面', '测试店（南门）')]
  assert.deepEqual(findSimilarFoods(foods, ' ＡＢ饭 ', '测试店 南门').map((item) => item.id), ['same'])
})

test('相似菜品同时比较名称与地点，避免不同地点的同名菜误提示', () => {
  const foods = [food('east', '番茄炒蛋饭', '测试东区'), food('west', '番茄炒蛋饭', '测试西区')]
  assert.deepEqual(findSimilarFoods(foods, '番茄炒蛋', '测试西区').map((item) => item.id), ['west'])
})

test('尚未填写地点时仍可提示同名菜品', () => {
  const foods = [food('same', '番茄饭', '测试地点')]
  assert.deepEqual(findSimilarFoods(foods, '番茄饭', '').map((item) => item.id), ['same'])
})

test('名称输入过短时不提供大量无关的相似结果', () => {
  const foods = [food('same', '番茄饭', '测试地点')]
  assert.deepEqual(findSimilarFoods(foods, '饭', ''), [])
  assert.deepEqual(findSimilarFoods(foods, '  ', ''), [])
})

test('相似提示最多显示三条，保留输入资料的顺序', () => {
  const foods = [food('first', '番茄饭', '测试地点'), food('second', '番茄饭', '测试地点'), food('third', '番茄饭', '测试地点'), food('fourth', '番茄饭', '测试地点')]
  assert.deepEqual(findSimilarFoods(foods, '番茄饭', '测试地点').map((item) => item.id), ['first', 'second', 'third'])
})
