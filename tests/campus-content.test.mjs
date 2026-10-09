import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { filterGuides, filterAccounts, filterWebsites, findRelatedSources, sourceSearchUrl, suggestGuides, guideIdForWebsite, websiteSearchDetails, primaryGuideAction, guideSearchMatch, searchTextParts } from '../src/lib/campusContent.ts'
const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))
const guides = read('guides'), accounts = read('accounts'), websites = read('websites')

test('110条原始问题均可追溯，合并后没有丢失或重复行号', () => {
  assert.deepEqual(guides.flatMap((guide) => guide.sourceRows).sort((a, b) => a - b), Array.from({ length: 110 }, (_, i) => i + 2))
  assert.equal(new Set(guides.map((guide) => guide.id)).size, guides.length)
  for (const guide of guides) { assert.ok(guide.summary); assert.ok(guide.steps.length); assert.equal(guide.isExample, false) }
})

test('48个公众号全部对应真实图片，个人和校外账号保留原始分类及备注', () => {
  assert.equal(accounts.length, 48)
  for (const account of accounts) assert.ok(existsSync(new URL(`../public${account.image}`, import.meta.url)), account.name)
  assert.equal(accounts.find((account) => account.name === '彩虹人生').category, '校外公益/合作')
  const truncated = accounts.find((account) => account.name === '路老师的nonsense c')
  assert.equal(truncated.category, '个人兴趣账号')
  assert.match(truncated.notes, /名称不全/)
  assert.match(accounts.find((account) => account.name === '拓浙AI生态').notes, /简介未显示/)
})

test('指南可按答案地点与多个关键词搜索，并组合类别筛选', () => {
  assert.ok(filterGuides(guides, '青溪翠柏').some((guide) => guide.id === 'campus-101'))
  assert.ok(filterGuides(guides, '校园卡 补办', '校园卡').some((guide) => guide.id === 'campus-card-replacement'))
  assert.equal(filterGuides(guides, '校园卡 补办', '交流与发展').length, 0)
  assert.ok(filterGuides(guides, 'ｖｐｎ').length > 0)
})

test('公众号搜索同时匹配主题和分类，不把组织账号自动变成官方账号', () => {
  const result = filterAccounts(accounts, '志愿', '学生组织与活动')
  assert.ok(result.some((account) => account.name === '浙大青志'))
  assert.ok(result.every((account) => account.category === '学生组织与活动'))
  assert.equal(filterAccounts(accounts, '不存在的账号999').length, 0)
})

test('网站入口与指南对应，所有链接使用http或https且不携带凭据', () => {
  assert.equal(new Set(websites.map((site) => site.url.replace(/\/$/, ''))).size, websites.length)
  for (const website of websites) {
    const url = new URL(website.url)
    assert.ok(['http:', 'https:'].includes(url.protocol))
    assert.equal(url.username, ''); assert.equal(url.password, '')
    assert.ok(website.guideIds.every((id) => guides.some((guide) => guide.id === id)))
    if (website.scope === '学校域名') assert.ok(url.hostname === 'zju.edu.cn' || url.hostname.endsWith('.zju.edu.cn'))
  }
  assert.ok(filterWebsites(websites, '校历').length > 0)
})

test('官网纠正的毕业班例外、补入的校历和旧详情链接均保留', () => {
  assert.match(guides.find((guide) => guide.sourceRows.includes(21)).steps.join(' '), /毕业班.*例外/)
  assert.ok(guides.find((guide) => guide.sourceRows.includes(95)).references.some((reference) => reference.url.includes('ugrs.zju.edu.cn')))
  assert.ok(guides.some((guide) => guide.aliases?.includes('campus-card-lost')))
  assert.ok(guides.some((guide) => guide.id === 'venue-reservation'))
  assert.ok(guides.some((guide) => guide.id === 'campus-hospital-registration'))
})
test('服务窗口电话与异常处理可被搜索，窗口关联不会落到其他类别', () => {
  const windows = read('service-windows')
  const campusCards = guides.filter((guide) => guide.category === '校园卡')
  assert.equal(campusCards.length, 7)
  assert.deepEqual(filterGuides(guides, '87572114', '', windows).map((guide) => guide.id).sort(), campusCards.map((guide) => guide.id).sort())
  assert.ok(filterGuides(guides, '热水 校正', '校园卡', windows).some((guide) => guide.id === 'campus-card-replacement'))
  assert.equal(filterGuides(guides, '87572114', '交流与发展', windows).length, 0)
  for (const guide of campusCards) {
    assert.ok(guide.serviceWindowIds.every((id) => windows.some((window) => window.id === id)))
    assert.ok((guide.relatedGuideIds ?? []).every((id) => guides.some((target) => target.id === id)))
  }
})

test('待确认窗口时间保留边界，充值方式不会被误列成顺序步骤', () => {
  const windows = read('service-windows')
  const zhoushan = windows.find((window) => window.campus === '舟山')
  assert.equal(zhoushan.hoursStatus, 'needs_confirmation')
  assert.match(zhoushan.openingHours, /旧.*参考/)
  const recharge = guides.find((guide) => guide.id === 'campus-047')
  assert.equal(recharge.kind, 'options')
  assert.ok(recharge.completionNote)
  for (const guide of guides.filter((guide) => guide.category === '校园卡')) {
    assert.doesNotMatch([guide.summary, ...guide.steps, ...guide.troubleshooting].join(' '), /本稿|第[56]项|中国银行移动端APP可以设置/)
    assert.equal(guide.references.length, 1)
  }
})

test('自然提问与近义词把主要办事指南排在首位', () => {
  const windows = read('service-windows')
  for (const [query, expected] of [
    ['寝室灯坏了', 'campus-010'],
    ['寝室灯坏了怎么办？', 'campus-010'],
    ['我想补学生卡', 'campus-card-replacement'],
    ['图书馆自习怎么办', 'campus-009'],
    ['宿舍报修', 'campus-010'],
    ['请帮我补饭卡', 'campus-card-replacement'],
    ['我的校园卡丢了', 'campus-card-replacement'],
    ['图书馆自习', 'campus-009'],
    ['我要打印成绩', 'campus-097'],
    ['怎么申请在校证明？', 'campus-098'],
    ['取消球场预约', 'campus-011'],
    ['校外访问', 'campus-012'],
    ['请问在哪里交网费', 'campus-040'],
    ['ＯＦＦＩＣＥ', 'campus-013'],
  ]) assert.equal(filterGuides(guides, query, '', windows)[0]?.id, expected, query)
})

test('未知问题与互不相关的组合不会因问句清理误返回全部指南', () => {
  const windows = read('service-windows')
  for (const query of ['你好', '怎么办', '？', '校园卡 奖学金', '图书馆 飞船999', '不存在的事务987'])
    assert.equal(filterGuides(guides, query, '', windows).length, 0, query)
  assert.equal(filterGuides(guides, '').length, 95)
  assert.equal(filterGuides(guides, '寝室灯坏了', '校园卡').length, 0)
})

test('其余指南均具有完整操作信息，原始问题保留，关联不悬空', () => {
  assert.equal(guides.filter((guide) => guide.category !== '校园卡').length, 88)
  for (const guide of guides) {
    assert.ok(guide.steps.length >= 3, guide.id)
    assert.ok(guide.materials.length > 0, guide.id)
    if (guide.category !== '校园卡') assert.ok(guide.completionNote, guide.id)
    assert.ok(guide.troubleshooting?.length > 0, guide.id)
    assert.ok(guide.references.length > 0, guide.id)
    assert.doesNotMatch(guide.summary, /…|原表|原始资料|小组资料/, guide.id)
    assert.doesNotMatch([...guide.notes, ...guide.steps].join(' '), /原表|本轮整理|本轮核对|本稿/, guide.id)
    assert.ok((guide.relatedGuideIds ?? []).every((id) => id !== guide.id && guides.some((target) => target.id === id)), guide.id)
    assert.ok(guide.relatedSourceIds.every((id) => accounts.some((account) => account.id === id)), guide.id)
  }
})

test('不同业务窗口独立关联，电话和人工时段可检索', () => {
  const windows = read('service-windows')
  assert.equal(windows.length, 27)
  assert.equal(new Set(windows.map((window) => window.id)).size, windows.length)
  for (const guide of guides)
    assert.ok((guide.serviceWindowIds ?? []).every((id) => windows.some((window) => window.id === id)), guide.id)
  assert.equal(filterGuides(guides, '88273001', '', windows)[0].id, 'campus-015')
  assert.equal(filterGuides(guides, '057188273001', '', windows)[0].id, 'campus-015')
  assert.equal(filterGuides(guides, '8:30', '校园卡', windows).length, 7)
  assert.equal(filterGuides(guides, '88981819', '', windows)[0].id, 'campus-101')
  assert.equal(filterGuides(guides, '银泉 人工 18:30', '', windows)[0].id, 'campus-101')
  assert.equal(windows.filter((window) => window.id.startsWith('post-')).length, 14)
  assert.match(windows.find((window) => window.id === 'network-xixi').openingHours, /周二、四/)
  assert.equal(windows.find((window) => window.id === 'network-xixi').location, '西六教学楼333室')
})

test('网站导航包含新办理入口和完整摘要，学校与校外链接区分保留', () => {
  assert.equal(websites.length, 86)
  assert.equal(read('content-manifest').websiteCount, websites.length)
  assert.equal(read('content-manifest').serviceWindowCount, read('service-windows').length)
  for (const guide of guides)
    for (const reference of guide.references)
      assert.ok(websites.some((site) => site.url.replace(/\/$/, '') === reference.url.replace(/\/$/, '') && site.guideIds.includes(guide.id)), reference.url)
  for (const site of websites) assert.doesNotMatch(site.summary, /…|原表|资料提供/, site.id)
  assert.ok(websites.some((site) => site.url === 'https://pay.zju.edu.cn/'))
  assert.ok(websites.some((site) => site.url === 'https://mail.zju.edu.cn/'))
})


test('丢卡和问地点的自然表述仍能找到补卡指南', () => {
  for (const query of ['饭卡不见了', '到哪里补卡', '一卡通遗失了怎么办'])
    assert.equal(filterGuides(guides, query)[0]?.id, 'campus-card-replacement', query)
  assert.equal(filterWebsites(websites, '饭卡不见了', '', guides)[0]?.id, 'website-0fc11a295f')
})

test('相关信息源去重，未知问题不展示无关的全量目录', () => {
  const related = findRelatedSources(websites, accounts, '饭卡不见了', filterGuides(guides, '饭卡不见了'))
  assert.ok(related.websites.some((site) => site.url.includes('itc.zju.edu.cn')))
  assert.equal(new Set(related.websites.map((site) => site.id)).size, related.websites.length)
  for (const query of ['', '你好', '？', '不存在的事务987'])
    assert.deepEqual(findRelatedSources(websites, accounts, query, []), { websites: [], accounts: [] })
})

test('近似建议与准确结果分开，并保持类别限制', () => {
  assert.equal(filterGuides(guides, '校园卡 飞船999').length, 0)
  assert.ok(suggestGuides(guides, '校园卡 飞船999').length > 0)
  assert.equal(suggestGuides(guides, '你好').length, 0)
  assert.equal(suggestGuides(guides, '校园卡 飞船999', '交流与发展').length, 0)
  const url = new URL(sourceSearchUrl('饭卡不见了 & ?你好', 'websites'), 'https://example.com')
  assert.equal(url.searchParams.get('q'), '饭卡不见了 & ?你好')
  assert.equal(url.searchParams.get('kind'), 'websites')
  assert.equal(new URL(sourceSearchUrl('你好', 'accounts'), 'https://example.com').searchParams.get('q'), '你好')
})


test('全部95份指南提供对应步骤的真实参考或平台链接，不再提供App路径复制', () => {
  assert.equal(guides.length, 95)
  const windows = read('service-windows')
  for (const guide of guides) {
    assert.ok(guide.stepActions.length > 0, guide.id)
    const primary = primaryGuideAction(guide)
    assert.ok(primary?.url && primary.label, guide.id)
    assert.ok(guide.stepActions.includes(primary))
    for (const action of guide.stepActions) {
      assert.ok(Number.isInteger(action.stepIndex) && action.stepIndex >= 0 && action.stepIndex < guide.steps.length, guide.id)
      assert.ok(['reference', 'service', 'windows'].includes(action.kind))
      assert.equal(action.path, undefined)
      if (action.kind === 'windows') assert.ok(guide.serviceWindowIds?.some((id) => windows.some((window) => window.id === id)), guide.id)
      else {
        assert.ok(guide.references.some((reference) => reference.url === action.url), guide.id)
        assert.ok(['https:', 'http:'].includes(new URL(action.url).protocol))
      }
    }
  }
})

test('说明与系统用途明确，不把App操作、馆方说明或通知当业务表单', () => {
  const actions = (id) => guides.find((guide) => guide.id === id).stepActions
  assert.ok(guides.filter((guide) => guide.category === '校园卡').every((guide) => guide.stepActions.every((action) => action.kind !== 'service')))
  for (const id of ['campus-041', 'campus-051', 'exam-deferral', 'academic-calendar', 'campus-097']) {
    assert.ok(actions(id).every((action) => action.kind !== 'service'), id)
  }
  const library = actions('campus-009').find((action) => action.kind === 'service')
  assert.equal(library.url, 'https://booking.lib.zju.edu.cn/')
  assert.match(library.label, /研讨空间/)
  assert.ok(!actions('campus-021').some((action) => action.url.includes('/cgyy/')))
  assert.ok(!actions('campus-102').some((action) => action.label.includes('心理')))
  assert.equal(primaryGuideAction(guides.find((guide) => guide.id === 'campus-hospital-registration')).url, 'https://xyszyl.zju.edu.cn/')
})

test('卡片入口优先提供平台，只有说明时使用说明，无入口时返回空', () => {
  const reference = { stepIndex: 0, kind: 'reference', label: '查看说明', url: 'https://example.com/info' }
  const service = { stepIndex: 1, kind: 'service', label: '打开平台', url: 'https://example.com/service' }
  const window = { stepIndex: 2, kind: 'windows', label: '查看窗口' }
  assert.equal(primaryGuideAction({ stepActions: [reference, window, service] }), service)
  assert.equal(primaryGuideAction({ stepActions: [window, reference] }), reference)
  assert.equal(primaryGuideAction({ stepActions: [window] }), undefined)
  assert.equal(primaryGuideAction({}), undefined)
})

test('共用官网入口仍指向当前问题匹配的指南，而不是关联数组第一条', () => {
  const matched = filterGuides(guides, '找回校园卡')
  const site = websites.find((item) => item.guideIds.includes('campus-046'))
  assert.equal(site.guideIds[0], 'campus-003')
  assert.equal(guideIdForWebsite(site, matched), 'campus-046')
  assert.equal(websiteSearchDetails(site, matched).name, '后勤集团挂失与解挂操作说明')
  assert.equal(websiteSearchDetails(site, matched).summary, guides.find((guide) => guide.id === 'campus-046').summary)
  assert.equal(websiteSearchDetails(site, []).name, site.name)
  assert.equal(guideIdForWebsite(site, []), 'campus-003')
})


test('量词自然问法识别已知事务，同时保留未知对象和条件', () => {
  for (const [query, id] of [
    ['我想预约一个自习座位', 'campus-009'], ['我要找一个自习位置', 'campus-009'],
    ['请帮我打印一份成绩单', 'campus-097'], ['怎么预约一间研讨室', 'campus-009'],
  ]) assert.equal(filterGuides(guides, query)[0]?.id, id, query)
  for (const query of ['预约一个飞船999', '校园卡 飞船999', '图书馆 免费包过999']) assert.equal(filterGuides(guides, query).length, 0)
})

test('匹配片段来自对应正文并定位取消操作而不是一般阅读要求', () => {
  const guide = guides.find((item) => item.id === 'campus-009')
  const match = guideSearchMatch(guide, '图书馆 取消')
  assert.equal(match.anchor, 'guide-step-3')
  assert.ok(guide.steps[3].includes(match.text.replace(/^…|…$/g, '')))
  assert.equal(guideSearchMatch(guide, ''), undefined)
  assert.equal(guideSearchMatch(guide, '飞船999'), undefined)
  const card = guides.find((item) => item.id === 'campus-card-replacement')
  const windows = read('service-windows')
  assert.equal(guideSearchMatch(card, '87572114', windows).anchor, 'guide-windows-heading')
})

test('文本高亮识别近义词，按字面处理特殊符号并完整保留原文', () => {
  const text = '校园卡遗失，请先挂失；可用.*[a]和<script>字面搜索。'
  for (const query of ['饭卡', '.*', '[a]', '<script>', '\\', '?']) {
    const parts = searchTextParts(text, query)
    assert.equal(parts.map((part) => part.text).join(''), text)
  }
  assert.ok(searchTextParts(text, '饭卡').some((part) => part.matched && part.text === '校园卡'))
  assert.ok(searchTextParts('其他内容', '.*').every((part) => !part.matched))
  assert.ok(searchTextParts('其他内容', '[a]').every((part) => !part.matched))
})
