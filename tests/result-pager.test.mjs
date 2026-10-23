import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveResultPager, resultPageLabel } from '../src/lib/resultPager.ts'

test('小结果集直接展示全部页码', () => {
  assert.deepEqual(deriveResultPager(2, 14, 6), { page: 2, pages: 3, items: [1, 2, 3] })
  assert.deepEqual(deriveResultPager(1, 0, 6), { page: 1, pages: 1, items: [1] })
  assert.deepEqual(deriveResultPager(1, 25, 6).items, [1, 2, 3, 4, 5])
})

test('首尾、中间和近边界只生成五个槽位，并可直接抵达首尾', () => {
  assert.deepEqual(deriveResultPager(1, 100, 1).items, [1, 2, 3, 'end-gap', 100])
  assert.deepEqual(deriveResultPager(3, 100, 1).items, [1, 2, 3, 'end-gap', 100])
  assert.deepEqual(deriveResultPager(4, 100, 1).items, [1, 'start-gap', 4, 'end-gap', 100])
  assert.deepEqual(deriveResultPager(98, 100, 1).items, [1, 'start-gap', 98, 99, 100])
  assert.deepEqual(deriveResultPager(100, 100, 1).items, [1, 'start-gap', 98, 99, 100])
})

test('非法页码重置为第一页，越界整数夹取至末页', () => {
  for (const page of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(deriveResultPager(page, 14, 6).page, 1)
  assert.equal(deriveResultPager(999, 14, 6).page, 3)
  for (const total of [-1, NaN, Infinity]) assert.equal(deriveResultPager(2, total, 6).pages, 1)
  for (const size of [0, -1, NaN, Infinity]) assert.equal(deriveResultPager(2, 14, size).pages, 1)
})

test('极大结果数保持常数大小，不创建长数组或重复页码', () => {
  for (const total of [6, 7, 100, 100_000_000, Number.MAX_SAFE_INTEGER, Number.MAX_VALUE]) {
    const pages = Math.min(total, Number.MAX_SAFE_INTEGER)
    for (const page of [1, 2, 3, 4, Math.floor(pages / 2), pages - 2, pages - 1, pages]) {
      const result = deriveResultPager(page, total, 1)
      const numbers = result.items.filter((item) => typeof item === 'number')
      assert.ok(result.items.length <= 5)
      assert.ok(numbers.includes(result.page))
      assert.equal(numbers[0], 1)
      assert.equal(numbers.at(-1), pages)
      assert.deepEqual(numbers, [...new Set(numbers)].sort((a, b) => a - b))
    }
  }
  assert.equal(deriveResultPager(2, Number.MAX_VALUE, Number.MIN_VALUE).pages, Number.MAX_SAFE_INTEGER)
})

test('长页码标签只做视觉缩短，普通页码保持原数值', () => {
  assert.equal(resultPageLabel(9999), '9999')
  assert.equal(resultPageLabel(10_000), '1万')
  assert.equal(resultPageLabel(125_000), '12.5万')
  assert.equal(resultPageLabel(100_000_000), '1亿')
  assert.equal(resultPageLabel(Number.MAX_SAFE_INTEGER), '9007.2万亿')
})
