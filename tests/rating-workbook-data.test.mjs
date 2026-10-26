import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const data = JSON.parse(await readFile(new URL('../src/data/food-rating-samples.json', import.meta.url), 'utf8'))
const count = row => row.histogram.reduce((sum, value) => sum + value, 0)
const scoreTotal = row => row.histogram.reduce((sum, value, index) => sum + value * (index + 1), 0)

test('工作簿样本保留已审阅文件的来源和模拟性质', () => {
  assert.deepEqual(data.source, {
    kind: 'simulation',
    sourceFile: '菜品评分数值收集.xlsx',
    // SHA-256 verified against the read-only source workbook on 2026-10-26.
    sourceSha256: 'f867831dd4dcb971b82c6c1ba266c62f976e15ad14a7ac76fa06a789cdfb38b7',
    sourceSheet: '菜品模拟汇总',
    detailSheet: '逐条模拟评分',
    importedOn: '2026-10-26',
    recordCount: 2510,
  })
})

test('48道菜使用唯一UUID，对应原汇总表第2至49行', () => {
  assert.equal(data.ratings.length, 48)
  assert.equal(new Set(data.ratings.map(row => row.foodId)).size, 48)
  for (const row of data.ratings) {
    assert.match(row.foodId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    assert.deepEqual(Object.keys(row).sort(), ['foodId', 'histogram', 'initialRating', 'sourceRow'])
  }
  assert.deepEqual(data.ratings.map(row => row.sourceRow), Array.from({ length: 48 }, (_, index) => index + 2))
})

test('固定五档计数是非负整数，每菜15至100份且不超出初评上下1星', () => {
  for (const row of data.ratings) {
    assert.ok(Number.isInteger(row.initialRating) && row.initialRating >= 1 && row.initialRating <= 5)
    assert.equal(row.histogram.length, 5)
    assert.ok(count(row) >= 15 && count(row) <= 100)
    row.histogram.forEach((value, index) => {
      assert.ok(Number.isSafeInteger(value) && value >= 0)
      if (value > 0) assert.ok(Math.abs(index + 1 - row.initialRating) <= 1)
    })
  }
})

test('2510份样本与逐条表和汇总表的已核对合计一致', () => {
  assert.equal(data.ratings.reduce((sum, row) => sum + count(row), 0), 2510)
  assert.equal(data.source.recordCount, data.ratings.reduce((sum, row) => sum + count(row), 0))
})

test('原汇总首道菜保留29份与4.0均分，不重新随机', () => {
  const row = data.ratings[0]
  assert.equal(row.foodId, '335f9643-764c-4ce4-96d8-8d5f1f349e11')
  assert.equal(row.sourceRow, 2)
  assert.equal(row.initialRating, 4)
  assert.deepEqual(row.histogram, [0, 0, 8, 13, 8])
  assert.equal(count(row), 29)
  assert.equal(scoreTotal(row), 116)
  assert.equal(scoreTotal(row) / count(row), 4)
})

test('巧克力冰沙保留69份与317总星数，原均分约4.5942', () => {
  const row = data.ratings.find(row => row.foodId === 'da41234b-8ba3-4548-984d-a28577f0faa2')
  assert.ok(row)
  assert.equal(row.sourceRow, 6)
  assert.equal(row.initialRating, 5)
  assert.deepEqual(row.histogram, [0, 0, 0, 28, 41])
  assert.equal(count(row), 69)
  assert.equal(scoreTotal(row), 317)
  assert.equal((scoreTotal(row) / count(row)).toFixed(4), '4.5942')
})
