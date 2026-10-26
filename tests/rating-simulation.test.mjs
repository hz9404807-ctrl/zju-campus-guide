import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateRating } from '../src/lib/ratingSimulation.ts'

test('模拟评分可复现，刷新、列表和详情使用同一组样本', () => {
  const expected = simulateRating('food-a', 4)
  assert.deepEqual(simulateRating('food-a', 4), expected)
  assert.deepEqual(simulateRating('food-a', 4, 'campus-rating-v1'), expected)
  assert.notEqual(simulateRating('food-a', 4).histogram, expected.histogram)
  assert.notDeepEqual(simulateRating('food-a', 4, 'another-demonstration'), expected)
  assert.notDeepEqual(simulateRating('food-b', 4), expected)
})

test('每道菜15～100份样本，每份在初始评分±1及1～5星范围内，均分与直方图一致', () => {
  for (let initial = 1; initial <= 5; initial += 1) {
    for (let index = 0; index < 600; index += 1) {
      const sample = simulateRating(`food-${index}`, initial, 'fixed-test-seed')
      assert.equal(sample.initialRating, initial)
      assert.ok(Number.isInteger(sample.count) && sample.count >= 15 && sample.count <= 100)
      assert.equal(sample.histogram.length, 5)
      assert.ok(sample.histogram.every(count => Number.isInteger(count) && count >= 0))
      assert.equal(sample.histogram.reduce((sum, count) => sum + count, 0), sample.count)
      let total = 0
      for (let star = 1; star <= 5; star += 1) {
        if (star < initial - 1 || star > initial + 1) assert.equal(sample.histogram[star - 1], 0)
        total += star * sample.histogram[star - 1]
      }
      assert.equal(sample.average, Number((total / sample.count).toFixed(1)))
      assert.ok(sample.average >= Math.max(1, initial - 1) && sample.average <= Math.min(5, initial + 1))
    }
  }
})

test('随机样本数量覆盖15和100以及区间内全部整数，不固定为同一个人数', () => {
  const counts = new Set(Array.from({ length: 2000 }, (_, index) => simulateRating(`food-${index}`, 3).count))
  assert.equal(counts.size, 86)
  assert.ok(counts.has(15))
  assert.ok(counts.has(100))
})

test('不接受缺失、非整数或超出1～5星的初始评分', () => {
  for (const initial of [undefined, null, NaN, Infinity, -Infinity, 0, 6, -1, 1.5, '4']) {
    assert.throws(() => simulateRating('food-a', initial), RangeError)
  }
})

test('模拟函数不依赖全局随机数，返回值只有样本元信息', () => {
  const previous = Math.random
  try {
    Math.random = () => { throw Error('不应依赖全局随机状态') }
    assert.deepEqual(Object.keys(simulateRating('food-a', 4)).sort(), ['average', 'count', 'histogram', 'initialRating'])
  } finally {
    Math.random = previous
  }
})
