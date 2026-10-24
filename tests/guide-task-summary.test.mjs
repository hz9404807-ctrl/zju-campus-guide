import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guideTaskSummary } from '../src/lib/guideTaskSummary.ts'
import { guideRouteView } from '../src/lib/campusContent.ts'
const guides = JSON.parse(readFileSync(new URL('../src/data/guides.json', import.meta.url)))

test('多种身份总览仅提示先选方式，不混合材料或虚构统一步骤', () => {
  const guide = guides.find(item => item.routes?.length > 1)
  const rows = guideTaskSummary(guide, true, 7)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].anchor, 'guide-methods-heading')
  assert.match(rows[0].text, new RegExp(String(guide.routes.length)))
})
test('每条路线使用实际材料、操作和窗口，不继承其他身份的数据', () => {
  for (const original of guides) for (const route of original.routes ?? []) {
    const view = guideRouteView(original, route)
    const rows = guideTaskSummary(view, false, view.serviceWindowIds?.length ?? 0)
    assert.equal(rows[0].text, view.materials.length ? `${view.materials.length}项` : '本条未列明')
    assert.equal(rows[1].text, view.steps.length ? `${view.steps.length}项` : '本条未列明')
    assert.equal(rows[2].anchor === 'guide-windows-heading', !!(view.serviceWindowIds?.length || view.location || view.openingHours || view.contact))
  }
})
test('缺少材料地点不等于无需准备或纯线上办理，不生成空锚点', () => {
  const guide = { ...guides[0], materials: [], steps: [], location: null, openingHours: null, contact: null }
  assert.ok(guideTaskSummary(guide, false, 0).every(row => row.text === '本条未列明' && row.anchor === null))
})
test('充值等并列选项和说明不会被称为顺序办理步骤', () => {
  const options = { ...guides[0], kind: 'options' }
  const resource = { ...guides[0], kind: 'resource' }
  assert.equal(guideTaskSummary(options, false, 0)[1].label, '可选方式')
  assert.equal(guideTaskSummary(resource, false, 0)[1].label, '事项说明')
})
