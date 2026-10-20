import assert from 'node:assert/strict'
import test from 'node:test'
import { parseResultPage } from '../src/lib/resultPagination.ts'

test('整页URL页码保留，超出末页时按实际结果数夹取', () => {
  assert.equal(parseResultPage('1', 98, 24), 1)
  assert.equal(parseResultPage('3', 98, 24), 3)
  assert.equal(parseResultPage('5', 98, 24), 5)
  assert.equal(parseResultPage('99', 98, 24), 5)
  assert.equal(parseResultPage('5', 48, 12), 4)
  assert.equal(parseResultPage(String(Number.MAX_SAFE_INTEGER), 98, 24), 5)
})

test('小数、负数和非整数形式不会产生跨页切片', () => {
  for (const value of ['1.5', '2.3', '2.0', '-1', '0', '+2', '1e2', '0x2', ' 2 ', '02']) {
    assert.equal(parseResultPage(value, 98, 24), 1, value)
  }
})

test('空值、非数字和不可安全表示的页码恢复第一页', () => {
  for (const value of [null, '', 'page', 'NaN', 'Infinity', '-Infinity', '9007199254740992', '9'.repeat(400)]) {
    assert.equal(parseResultPage(value, 98, 24), 1, String(value))
  }
})

test('空结果和不足一页的结果始终使用第一页', () => {
  for (const total of [0, 1, 12, 24]) {
    assert.equal(parseResultPage('2', total, 24), 1)
  }
  assert.equal(parseResultPage('2', 25, 24), 2)
})

test('无效的结果数或每页数量不会生成无效页码', () => {
  for (const total of [-1, NaN, Infinity]) assert.equal(parseResultPage('2', total, 24), 1)
  for (const size of [0, -1, NaN, Infinity]) assert.equal(parseResultPage('2', 98, size), 1)
})
