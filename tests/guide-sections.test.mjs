import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guideSections } from '../src/lib/guideSections.ts'
import { guideRouteView } from '../src/lib/campusContent.ts'
const guides = JSON.parse(readFileSync(new URL('../src/data/guides.json', import.meta.url), 'utf8'))

test('成绩单切换身份时只提供当前流程存在的导航，窗口不会从本科路线遗留', () => {
  const transcript = guides.find((g) => g.id === 'campus-097')
  for (const route of transcript.routes) {
    const view = guideRouteView(transcript, route)
    const sections = guideSections(view, false, !!view.serviceWindowIds?.length, '具体操作')
    assert.equal(sections.some((s) => s.id === 'guide-windows-heading'), route.id === 'seal')
    assert.ok(sections.some((s) => s.id === 'guide-steps-heading'))
    assert.ok(sections.some((s) => s.id === 'guide-references-heading'))
  }
  assert.deepEqual(guideSections(transcript, true, false, '具体操作').map((s) => s.id), ['guide-methods-heading', 'guide-references-heading'])
})

test('没有材料、窗口、问题或参考的入口页不会生成空导航', () => {
  const minimal = { ...guides[0], materials: [], steps: ['打开入口'], notes: [], references: [], troubleshooting: [] }
  assert.deepEqual(guideSections(minimal, false, false, '如何使用这个入口'), [{ id: 'guide-steps-heading', label: '如何使用这个入口' }])
  minimal.notes = ['核对账号']
  assert.equal(guideSections(minimal, false, false, '如何使用这个入口').at(-1).id, 'guide-notes-heading')
})

test('全部指南及路线的目录保持唯一、简短，使用实际渲染内容', () => {
  for (const original of guides) for (const route of [undefined, ...(original.routes ?? [])]) {
    const view = guideRouteView(original, route)
    const sections = guideSections(view, !!original.routes?.length && !route, !!view.serviceWindowIds?.length || !!(view.location || view.openingHours || view.contact), '具体操作')
    assert.equal(new Set(sections.map((s) => s.id)).size, sections.length)
    assert.ok(sections.length <= 5)
    assert.equal(sections.some((s) => s.id === 'guide-references-heading'), view.references.length > 0)
    assert.ok(sections.every((s) => s.label))
  }
})
