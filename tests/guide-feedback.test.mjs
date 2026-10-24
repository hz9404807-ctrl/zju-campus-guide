import assert from 'node:assert/strict'
import test from 'node:test'
import guides from '../src/data/guides.json' with { type: 'json' }
import { buildGuideFeedback, GUIDE_FEEDBACK_LIMIT, guideFeedbackPath, recordedGuideDate } from '../src/lib/guideFeedback.ts'

const guide = { id: 'campus-card', title: '校园卡怎么补办？', routes: [{ id: 'student', label: '在校学生' }] }

test('反馈地址只保留资料内的指南和办理路线', () => {
  assert.equal(guideFeedbackPath(guide, 'student'), '/guides/campus-card?route=student')
  for (const route of [undefined, 'all', 'unknown', 'student&q=private', '//evil.test', 'javascript:alert(1)']) assert.equal(guideFeedbackPath(guide, route), '/guides/campus-card')
  for (const id of ['../private', '//evil.test', 'https://evil.test', 'ok?token=secret', 'a\u0000b', 'A', 'x'.repeat(101)]) assert.equal(guideFeedbackPath({ ...guide, id }), null)
})

test('固定 GitHub 新建页只生成草稿，不附加宿主 URL 或其他上下文', () => {
  const draft = buildGuideFeedback(guide, 'student', 'link', '链接返回 404，请检查。')
  const url = new URL(draft.issueUrl)
  assert.equal(url.origin, 'https://github.com')
  assert.equal(url.pathname, '/hz9404807-ctrl/zju-campus-guide/issues/new')
  assert.deepEqual([...url.searchParams.keys()], ['title', 'body'])
  assert.equal(url.searchParams.get('body'), draft.text)
  assert.ok(draft.text.includes('页面：/guides/campus-card?route=student'))
  for (const forbidden of ['returnTo', 'studio_token', 'access_token', '验证码=', 'q=']) assert.ok(!draft.issueUrl.includes(forbidden))
  assert.equal(url.username, '')
  assert.equal(url.password, '')
})

test('路线必须来自当前指南，不接收其他指南的合法路线', () => {
  const draft = buildGuideFeedback(guide, 'graduate', 'missing', '')
  assert.equal(draft.path, '/guides/campus-card')
  assert.ok(!draft.text.includes('办理路线'))
  assert.ok(!draft.text.includes('graduate'))
})

test('问题类型和控制字符安全回退，正文保持可复制的真实文字', () => {
  const draft = buildGuideFeedback(guide, undefined, 'https://evil.test', '第一行\r\n第二行\u0000\u001b <script>测试</script>&route=other')
  assert.ok(draft.text.includes('问题类型：其他问题'))
  assert.ok(draft.text.includes('第一行\n第二行 <script>测试</script>&route=other'))
  assert.ok(!/[\u0000\u001b\r]/.test(draft.text))
  const url = new URL(draft.issueUrl)
  assert.equal(url.searchParams.get('route'), null)
  assert.equal(url.searchParams.get('body'), draft.text)
})

test('限制长标题、路线标签和说明，中文及 emoji 编码可还原', () => {
  for (const content of ['🐧中文', '中文', '🐧']) {
    const draft = buildGuideFeedback({ ...guide, title: content.repeat(1000), routes: [{ id: 'student', label: content.repeat(1000) }] }, 'student', 'changed', content.repeat(1000))
    const details = draft.text.split('问题说明：\n')[1]
    assert.ok(details.length <= GUIDE_FEEDBACK_LIMIT)
    assert.ok(details.length >= GUIDE_FEEDBACK_LIMIT - 1)
    assert.ok(!/[\ud800-\udbff]$/.test(details))
    assert.equal(new URL(draft.issueUrl).searchParams.get('body'), draft.text)
    assert.ok(draft.issueUrl.length < 8000)
  }
})

test('没有填写说明时提供待填写草稿，非法指南不生成跳转', () => {
  assert.ok(buildGuideFeedback(guide, undefined, 'missing', ' ').text.includes('请在提交前补充'))
  assert.equal(buildGuideFeedback({ ...guide, id: '//other' }, undefined, 'link', ''), null)
})

test('日期只显示合法原始日期，保留收集和核对的独立语义', () => {
  for (const date of ['2026-10-08', '2026-10-09', '2024-02-29']) assert.equal(recordedGuideDate(date), date)
  for (const date of [null, undefined, '', 'today', '2026-2-01', '2026-02-29', '2026-04-31', '2026-10-08T00:00:00Z', '2026-13-01']) assert.equal(recordedGuideDate(date), null)
})

test('当前真实指南与全部办理路线可生成固定仓库反馈', () => {
  for (const current of guides) {
    for (const routeId of [undefined, ...(current.routes ?? []).map((route) => route.id)]) {
      const draft = buildGuideFeedback(current, routeId, 'missing', '')
      assert.ok(draft, current.id)
      const page = new URL(draft.path, 'https://campus-guide.invalid')
      assert.equal(page.pathname, `/guides/${current.id}`)
      assert.deepEqual([...page.searchParams.keys()], routeId ? ['route'] : [])
    }
  }
})
