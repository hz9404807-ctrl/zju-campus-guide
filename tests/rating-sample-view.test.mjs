import test from 'node:test'
import assert from 'node:assert/strict'
import { getWorkbookRatingSample } from '../src/lib/ratingSamples.ts'

test('展示分数直接来自工作簿五档计数，保留一位小数', () => {
  const first = getWorkbookRatingSample('335f9643-764c-4ce4-96d8-8d5f1f349e11')
  assert.deepEqual(first, { initialRating: 4, histogram: [0, 0, 8, 13, 8], count: 29, average: 4 })
  const chocolate = getWorkbookRatingSample('da41234b-8ba3-4548-984d-a28577f0faa2')
  assert.equal(chocolate.count, 69)
  assert.equal(chocolate.average, 4.6)
})

test('缺失菜品不生成样本，返回值改动不污染导入数据', () => {
  assert.equal(getWorkbookRatingSample('not-in-workbook'), null)
  const id = '335f9643-764c-4ce4-96d8-8d5f1f349e11'
  const first = getWorkbookRatingSample(id)
  first.histogram[0] = 900
  assert.deepEqual(getWorkbookRatingSample(id).histogram, [0, 0, 8, 13, 8])
})
