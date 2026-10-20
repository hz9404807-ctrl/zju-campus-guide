import assert from 'node:assert/strict'
import test from 'node:test'
import { compareFoods, foodSortDescription, hasFoodPrice, hasFoodRating, parseFoodBudget, parseFoodSort } from '../src/lib/foodComparison.ts'

const food = (id, price, average_rating = null, rating_count = 0) => ({ id, price, average_rating, rating_count })
const ids = (rows) => rows.map((row) => row.id)

test('空预算保留未知价格，默认顺序沿用服务且不修改原数组', () => {
  const foods = [food('z', null), food('a', 10), food('b', 0)]
  const before = structuredClone(foods)
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget(), 'latest')), ['z', 'a', 'b'])
  assert.deepEqual(foods, before)
  assert.deepEqual(parseFoodBudget('  ', '\n'), { min: null, max: null, active: false, error: null, minError: false, maxError: false })
})

test('上下界均包含；任一预算生效时排除未知价格但保留真实零元', () => {
  const foods = [food('unknown', null), food('zero', 0), food('low', 9.99), food('edge', 10), food('high', 10.01)]
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget('0', '10'), 'latest')), ['zero', 'low', 'edge'])
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget('', '0'), 'latest')), ['zero'])
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget('10'), 'latest')), ['edge', 'high'])
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget('10', '10'), 'latest')), ['edge'])
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget('20', '30'), 'latest')), [])
})

test('边界金额允许空白、小数与发布金额上限，不进行隐式取整', () => {
  assert.deepEqual(parseFoodBudget(' .50 ', '99999.99'), { min: 0.5, max: 99999.99, active: true, error: null, minError: false, maxError: false })
  assert.equal(parseFoodBudget('000.00', '0.01').min, 0)
  assert.equal(parseFoodBudget('0.001').error !== null, true)
})

test('非法和颠倒预算不会当作零元或悄悄展示未筛选结果', () => {
  const foods = [food('normal', 10)]
  for (const raw of ['-1', '+1', 'Infinity', 'NaN', '0x10', '1e2', '1,000', '12元', '1.', '100000', '99999.999', '９']) {
    const budget = parseFoodBudget(raw)
    assert.ok(budget.error, raw)
    assert.equal(budget.minError, true)
    assert.deepEqual(compareFoods(foods, budget, 'latest'), [], raw)
  }
  const reversed = parseFoodBudget('10', '9.99')
  assert.equal(reversed.minError, true)
  assert.equal(reversed.maxError, true)
  assert.equal(reversed.error, '最低预算不能高于最高预算。')
  assert.deepEqual(compareFoods(foods, reversed, 'latest'), [])
})

test('升降价排序都将未知价格放在最后，同价用 ID 稳定排列', () => {
  const foods = [food('unknown-z', null), food('b', 10), food('zero', 0), food('a', 10), food('unknown-a', null), food('high', 50)]
  const before = structuredClone(foods)
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget(), 'price-asc')), ['zero', 'a', 'b', 'high', 'unknown-a', 'unknown-z'])
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget(), 'price-desc')), ['high', 'a', 'b', 'zero', 'unknown-a', 'unknown-z'])
  assert.deepEqual(foods, before)
})

test('评分排序按真实均分、人数、ID；无评分在后，不隐藏低样本高分', () => {
  const foods = [food('none-z', 1), food('few', 10, 5, 1), food('same-b', 10, 4.5, 10), food('same-a', 10, 4.5, 10), food('more', 20, 4.5, 20), food('none-a', 2, 5, 0)]
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget(), 'rating-desc')), ['few', 'more', 'same-a', 'same-b', 'none-a', 'none-z'])
  assert.deepEqual(ids(compareFoods(foods, parseFoodBudget('15'), 'rating-desc')), ['more'])
})

test('排序参数采用白名单，无效参数回退到默认排序', () => {
  for (const raw of ['price-asc', 'price-desc', 'rating-desc']) assert.equal(parseFoodSort(raw), raw)
  for (const raw of [null, undefined, '', 'latest', 'best', 'PRICE-ASC', '__proto__']) assert.equal(parseFoodSort(raw), 'latest')
  assert.match(foodSortDescription('price-asc'), /价格待补充.*最后/)
  assert.match(foodSortDescription('price-desc'), /价格待补充.*最后/)
  assert.match(foodSortDescription('rating-desc'), /同分时评分人数多/)
})

test('异常价格不会污染比较，评分须有真实人数', () => {
  for (const price of [null, NaN, Infinity, -1]) assert.equal(hasFoodPrice(food('bad', price)), false)
  assert.equal(hasFoodPrice(food('zero', 0)), true)
  assert.equal(hasFoodRating(food('not-rated', 0, null, 0)), false)
  assert.equal(hasFoodRating(food('missing-count', 0, 5, 0)), false)
  assert.equal(hasFoodRating(food('rated', 0, 5, 1)), true)
  assert.deepEqual(ids(compareFoods([food('bad', NaN), food('valid', 1)], parseFoodBudget('0'), 'price-asc')), ['valid'])
})
