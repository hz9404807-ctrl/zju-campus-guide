import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFoodSort, sortFoods } from '../src/lib/foodSorting.ts'

const rows = [
  { id: 'unknown', price: null, average_rating: null, rating_count: 0 },
  { id: 'zero', price: 0, average_rating: 3, rating_count: 1 },
  { id: 'b', price: 12.5, average_rating: 4.5, rating_count: 1 },
  { id: 'a', price: 12.5, average_rating: 4.5, rating_count: 8 },
  { id: 'high', price: 99999.99, average_rating: 1, rating_count: 20 },
  { id: 'unrated', price: null, average_rating: 5, rating_count: 0 },
]
const ids = result => result.map(row => row.id)

test('沿用现有分享参数，增加评分升序；缺省或未知值保留默认顺序', () => {
  for (const value of ['price-asc', 'price-desc', 'rating-asc', 'rating-desc']) assert.equal(parseFoodSort(value), value)
  for (const value of [undefined, null, '', 'latest', 'popular', 'PRICE-ASC']) assert.equal(parseFoodSort(value), 'latest')
})

test('价格两个方向都将缺失价格放最后，0和边界价格为真实值，同价按ID稳定', () => {
  assert.deepEqual(ids(sortFoods(rows, 'price-asc')), ['zero', 'a', 'b', 'high', 'unknown', 'unrated'])
  assert.deepEqual(ids(sortFoods(rows, 'price-desc')), ['high', 'a', 'b', 'zero', 'unknown', 'unrated'])
})

test('评分两个方向保留平均分含义，同分先按人数再按ID，无评分最后', () => {
  assert.deepEqual(ids(sortFoods(rows, 'rating-asc')), ['high', 'zero', 'a', 'b', 'unknown', 'unrated'])
  assert.deepEqual(ids(sortFoods(rows, 'rating-desc')), ['a', 'b', 'zero', 'high', 'unknown', 'unrated'])
  const tie = [{ ...rows[2], id: 'z', rating_count: 8 }, { ...rows[3], id: 'c' }]
  for (const sort of ['rating-asc', 'rating-desc']) assert.deepEqual(ids(sortFoods(tie, sort)), ['c', 'z'])
})

test('排序不修改共享列表，默认顺序保持服务返回顺序，空结果保持为空', () => {
  const before = structuredClone(rows)
  for (const sort of ['latest', 'price-asc', 'price-desc', 'rating-asc', 'rating-desc']) {
    const result = sortFoods(rows, sort)
    assert.notEqual(result, rows)
    assert.deepEqual(rows, before)
    assert.deepEqual(sortFoods([], sort), [])
  }
  assert.deepEqual(sortFoods(rows, 'latest'), rows)
})
