import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { filterGuides, filterAccounts, filterWebsites, findRelatedSources, sourceSearchUrl, suggestGuides, guideIdForWebsite, websiteSearchDetails, primaryGuideAction, guideSearchMatch, searchTextParts, resolveGuideRoute, guideDetailContext, guideRouteView, searchGuides } from '../src/lib/campusContent.ts'
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
  assert.deepEqual(filterGuides(guides, '87572114', '', windows).map((guide) => guide.id).sort(), [...campusCards.map((guide) => guide.id), 'campus-077'].sort())
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
  assert.equal(filterGuides(guides, '').length, 98)
  assert.equal(filterGuides(guides, '寝室灯坏了', '校园卡').length, 0)
})

test('其余指南均具有完整操作信息，原始问题保留，关联不悬空', () => {
  assert.equal(guides.filter((guide) => guide.category !== '校园卡').length, 91)
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
  assert.equal(websites.length, 100)
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


test('全部98份指南提供对应步骤的真实参考或平台链接，不再提供App路径复制', () => {
  assert.equal(guides.length, 98)
  const windows = read('service-windows')
  for (const guide of guides) {
    assert.ok(guide.stepActions.length > 0, guide.id)
    const primary = primaryGuideAction(guide)
    if (guide.routes?.length) assert.equal(primary, undefined, guide.id)
    else {
      assert.ok(primary?.url && primary.label, guide.id)
      assert.ok(guide.stepActions.includes(primary))
    }
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


test('情形选择只在明确需求时推断，显式选择和歧义都有安全回退', () => {
  const library = guides.find((g) => g.id === 'campus-009')
  const transcript = guides.find((g) => g.id === 'campus-097')
  assert.equal(resolveGuideRoute(library, '我想预约一个自习座位').id, 'seat')
  assert.equal(resolveGuideRoute(library, '预约研讨室').id, 'space')
  for (const query of ['', '图书馆预约', '座位 研讨空间']) assert.equal(resolveGuideRoute(library, query), undefined)
  assert.equal(resolveGuideRoute(library, '座位', 'space').id, 'space')
  for (const id of ['all', 'wrong']) assert.equal(resolveGuideRoute(library, '座位', id), undefined)
  assert.equal(resolveGuideRoute(transcript, '请帮我打印一份成绩单').id, 'print')
  assert.equal(resolveGuideRoute(transcript, '成绩单 打印 盖章').id, 'seal')
  assert.equal(resolveGuideRoute(transcript, '成绩单'), undefined)
})

test('卡片和正文使用同一路线，个人座位不误导到研讨空间，打印不误导到盖章窗口', () => {
  const library = guides.find((g) => g.id === 'campus-009')
  const transcript = guides.find((g) => g.id === 'campus-097')
  assert.equal(primaryGuideAction(library, '图书馆预约'), undefined)
  assert.equal(primaryGuideAction(library, '研讨室').url, 'https://booking.lib.zju.edu.cn/')
  assert.equal(primaryGuideAction(library, '自习座位').kind, 'reference')
  assert.match(primaryGuideAction(library, '自习座位').label, /官网找座位/)
  const view = guideRouteView(transcript, resolveGuideRoute(transcript, '打印成绩单'))
  assert.deepEqual(view.serviceWindowIds, [])
  assert.ok(!view.stepActions.some((action) => action.kind === 'windows'))
  assert.deepEqual(view.sourceRows, transcript.sourceRows)
  assert.equal(view.id, transcript.id)
  const seal = guideRouteView(transcript, resolveGuideRoute(transcript, '密封成绩单'))
  assert.deepEqual(seal.serviceWindowIds, ['transcript-zijingang'])
  const seat = guideRouteView(library, resolveGuideRoute(library, '座位取消'))
  const match = guideSearchMatch(seat, '座位 取消')
  assert.match(seat.steps[Number(match.anchor.split('-').at(-1))], /取消功能/)
})

test('试点路线的入口、步骤索引与原始来源一致，不生成未经核实的业务入口', () => {
  const windows = read('service-windows')
  assert.equal(guides.filter((g) => g.routes).length, 3)
  for (const guide of guides.filter((g) => g.routes)) {
    assert.equal(new Set(guide.routes.map((r) => r.id)).size, guide.routes.length)
    for (const route of guide.routes) {
      assert.ok(route.summary && route.steps.length && route.completionNote)
      for (const action of route.stepActions) {
        assert.ok(action.stepIndex >= 0 && action.stepIndex < route.steps.length)
        if (action.kind === 'windows') assert.ok(route.serviceWindowIds.some((id) => windows.some((w) => w.id === id)))
        else assert.ok(guide.references.some((reference) => reference.url === action.url))
      }
    }
  }
  const transcript = guides.find((g) => g.id === 'campus-097')
  const seal = transcript.routes.find((r) => r.id === 'seal')
  assert.match(seal.materials.join(' '), /在校本科生/)
  assert.match(seal.materials.join(' '), /A4手写委托书/)
  assert.match(seal.steps.join(' '), /周五15:30后/)
  assert.match(seal.steps.join(' '), /刷校园卡/)
})


test('选定路线的正文参考和搜索信息源不混入另一业务入口', () => {
  const library = guides.find((g) => g.id === 'campus-009')
  const seat = guideRouteView(library, resolveGuideRoute(library, '自习座位'))
  assert.ok(seat.references.every((r) => !r.url.includes('booking.lib')))
  const seatSources = findRelatedSources(websites, accounts, '我想预约一个自习座位', filterGuides(guides, '我想预约一个自习座位'))
  assert.ok(seatSources.websites.length)
  assert.ok(!seatSources.websites.some((s) => s.url.includes('booking.lib')))
  const spaceSources = findRelatedSources(websites, accounts, '预约研讨室', filterGuides(guides, '预约研讨室'))
  assert.ok(spaceSources.websites.some((s) => s.url.includes('booking.lib')))
  assert.deepEqual(guideRouteView(library).references, library.references)
})


test('研究生和毕业身份在卡片、显式路线及网站目录中不被导向在校本科生业务', () => {
  const guide = guides.find((g) => g.id === 'campus-097')
  for (const q of ['研究生成绩单盖章', '研究生打印成绩单', '毕业研究生成绩单']) {
    assert.equal(resolveGuideRoute(guide, q).id, 'graduate')
    assert.equal(resolveGuideRoute(guide, q, 'seal').id, 'seal')
    assert.ok(!primaryGuideAction(guide, q).url.includes('id=2664'))
    const sites = filterWebsites(websites, q, '', guides)
    assert.ok(sites.some((s) => s.url.includes('polymer.zju.edu.cn')))
    assert.ok(sites.every((s) => !s.url.includes('zdbk') && !s.url.includes('id=2664') && !s.url.includes('zje.zju')))
    for (const site of sites) assert.equal(websiteSearchDetails(site, [guide], q).routeId, 'graduate')
  }
  assert.equal(resolveGuideRoute(guide, '毕业生打印成绩单').id, 'other')
  assert.equal(primaryGuideAction(guide, '毕业生打印成绩单').url, 'https://acv.zju.edu.cn/yu/pages/cydjManager/yycd.html')
  assert.equal(resolveGuideRoute(guide, 'ZJE成绩单').id, 'zje')
  assert.equal(resolveGuideRoute(guide, '本科生 研究生 成绩单盖章'), undefined)
})

test('自习座位与研讨空间在完整目录和相关网站中使用一致目的地', () => {
  for (const q of ['自习座位', '我想预约一个自习座位', '自习座位取消']) {
    const matched = filterGuides(guides, q)
    assert.ok(matched.every((g) => g.id !== 'campus-084'))
    const sites = filterWebsites(websites, q, '', guides)
    assert.ok(sites.length > 0)
    assert.ok(sites.every((s) => !s.url.includes('booking.lib') && !s.url.includes('bing.com')))
    const related = findRelatedSources(websites, accounts, q, matched).websites
    assert.deepEqual(related.map((s) => s.id).sort(), sites.map((s) => s.id).sort())
    for (const site of sites) assert.equal(websiteSearchDetails(site, matched, q).routeId, 'seat')
  }
  assert.ok(filterWebsites(websites, '预约研讨室', '', guides).some((s) => s.url.includes('booking.lib')))
})

test('日常问题对应真实业务；金额夜间与退款条件明确保持未回答，未知条件不丢失', () => {
  for (const [q,id] of [['宿舍没网','campus-015'],['校园卡没钱了','campus-047'],['预约篮球场','campus-011'],['报修一直没人来','campus-010']]) {
    assert.equal(searchGuides(guides,q).guides[0]?.id,id,q)
  }
  for (const q of ['校园卡补办多少钱','晚上可以补校园卡吗','预约取消后钱没退']) {
    const result = searchGuides(guides,q)
    assert.ok(result.guides.length > 0,q)
    assert.ok(result.notice,q)
  }
  for (const q of ['校园卡 飞船999','校园卡补办多少钱 飞船999','费用']) assert.equal(searchGuides(guides,q).guides.length,0,q)
  assert.equal(filterGuides(guides,'校园卡补办多少钱').length,0)
})

test('明确校区优先使用已核实校区参考，不向其他校区扩展海宁规则', () => {
  const guide=guides.find((g)=>g.id==='campus-041')
  assert.ok(primaryGuideAction(guide,'海宁访客').url.includes('visitor-center'))
  assert.ok(!primaryGuideAction(guide,'紫金港访客').url.includes('visitor-center'))
  assert.ok(filterWebsites(websites,'紫金港访客','',guides).every((s)=>!s.url.includes('visitor-center')))
  assert.ok(guideRouteView(guide,undefined,'紫金港访客').references.every((r)=>!r.url.includes('visitor-center')))
})

test('失败恢复给出记录、实际承办方式及完成核对，不承诺未经核实的退款时限', () => {
  const byId=(id)=>guides.find((g)=>g.id===id)
  assert.match(byId('campus-010').troubleshooting.join(' '), /工单号.*宿管值班处/)
  assert.match(byId('campus-015').troubleshooting.join(' '), /工单号.*0571-87951669/)
  assert.match(byId('campus-011').troubleshooting.join(' '), /订单号.*取消时间/)
  assert.match(byId('campus-011').troubleshooting.join(' '), /不保证直接处理退款/)
})


test('窗口电话查询在指南和网站目录共用窗口数据，路线入口名称说明相同用途', () => {
  const windows=read('service-windows')
  const matched=searchGuides(guides,'88273001','',windows).guides
  assert.equal(matched[0].id,'campus-015')
  assert.ok(filterWebsites(websites,'88273001','',guides,windows).some((s)=>s.url.includes('itc.zju')))
  const seat=filterGuides(guides,'自习座位')
  const site=filterWebsites(websites,'自习座位','',guides)[0]
  assert.equal(websiteSearchDetails(site,seat,'自习座位').name,primaryGuideAction(seat[0],'自习座位').label)
})


test('已取消但未退款的问题定位异常处理，而非只定位取消入口', () => {
  const guide=guides.find((g)=>g.id==='campus-011')
  const match=guideSearchMatch(guide,'预约取消后钱没退')
  assert.match(match.anchor,/^guide-help-/)
  assert.match(guide.troubleshooting[Number(match.anchor.split('-').at(-1))],/退款状态/)
})


test('旧搜索身份不会锁住任何已发布路线，主动切换后不定位旧问题', () => {
  for (const guide of guides.filter((g) => g.routes?.length)) {
    for (const q of ['研究生成绩单盖章', '已毕业本科生成绩单', 'ZJE成绩单', '预约自习座位', '预约研讨室']) {
      const recommended = resolveGuideRoute(guide, q)
      for (const choice of guide.routes) {
        const context = guideDetailContext(guide, q, choice.id)
        assert.equal(context.route.id, choice.id, `${guide.id}: ${q} -> ${choice.id}`)
        const view = guideRouteView(guide, context.route, context.contentQuery)
        assert.deepEqual(view.steps, choice.steps)
        assert.deepEqual(view.materials, choice.materials)
        assert.equal(context.contentQuery, recommended?.id === choice.id ? q : '')
        if (context.contentQuery === '') assert.equal(guideSearchMatch(view, context.contentQuery), undefined)
      }
      const all = guideDetailContext(guide, q, 'all')
      assert.equal(all.route, undefined)
      if (recommended) assert.equal(all.contentQuery, '')
    }
  }
})

test('成绩单每一种身份均有适用范围和真实官方参考，毕业路线有实际预约入口', () => {
  const guide = guides.find((g) => g.id === 'campus-097')
  for (const choice of guide.routes) {
    assert.ok(choice.audienceNote)
    const view = guideRouteView(guide, choice)
    assert.ok(view.references.length > 0, choice.id)
    assert.ok(view.references.every((ref) => new URL(ref.url).hostname.endsWith('.zju.edu.cn')))
  }
  const alumni = guide.routes.find((r) => r.id === 'other')
  assert.match(alumni.steps.join(' '), /C座616室/)
  assert.match(alumni.steps.join(' '), /周五下午不对外查档/)
  assert.ok(alumni.stepActions.some((action) => action.kind === 'service'))
  assert.equal(resolveGuideRoute(guide, '国际联合学院成绩单'), undefined)
  assert.equal(resolveGuideRoute(guide, '浙大爱丁堡成绩单').id, 'zje')
})


test('财务新增指南可由关键词检索，SRTP关联并保留查询边界', () => {
  const find = (q) => filterGuides(guides, q)[0]?.id
  assert.equal(find('活动报销'), 'campus-112')
  assert.equal(find('电子发票'), 'campus-111')
  assert.ok(['campus-028','campus-029'].includes(find('SRTP报销')))
  assert.equal(find('报销进度'), 'campus-111')
  const general = guides.find((guide) => guide.id === 'campus-111')
  const activity = guides.find((guide) => guide.id === 'campus-112')
  const srtp = guides.find((guide) => guide.id === 'campus-028')
  assert.match(general.summary, /经费/); assert.match(general.summary, /授权/)
  assert.match(general.troubleshooting.join(' '), /历史报销单/); assert.match(general.troubleshooting.join(' '), /酬金明细/)
  assert.match(general.steps.join(' '), /提交、审核通过、财务付款和银行到账是不同状态/)
  assert.match(activity.materials.join(' '), /预决算表/); assert.match(activity.steps.join(' '), /获奖名单/); assert.match(activity.steps.join(' '), /合同或协议/)
  assert.ok(srtp.relatedGuideIds.includes('campus-111'))
  assert.ok(guides.find((guide) => guide.id === 'campus-029').relatedGuideIds.includes('campus-111'))
})


test('交通搜索进入正确情形，路线切换后材料、班表和参考不串线', () => {
  const find = (q) => filterGuides(guides, q)[0]?.id
  assert.equal(find('本科生班车预约'), 'campus-077')
  assert.equal(find('海宁班车'), 'campus-077')
  assert.equal(find('海宁地铁接驳'), 'campus-077')
  assert.equal(find('小白车'), 'campus-113')
  const shuttle = guides.find((guide) => guide.id === 'campus-077')
  assert.equal(resolveGuideRoute(shuttle, '本科生班车预约')?.id, 'hangzhou-campus')
  assert.equal(resolveGuideRoute(shuttle, '海宁班车')?.id, 'haining-intercampus')
  assert.equal(resolveGuideRoute(shuttle, '海宁地铁接驳')?.id, 'haining-metro')
  const city = guideRouteView(shuttle, resolveGuideRoute(shuttle, '', 'hangzhou-campus'))
  const haining = guideRouteView(shuttle, resolveGuideRoute(shuttle, '', 'haining-intercampus'))
  const metro = guideRouteView(shuttle, resolveGuideRoute(shuttle, '', 'haining-metro'))
  assert.match(city.steps.join(' '), /领取预约码/); assert.match(city.troubleshooting.join(' '), /87951545/)
  assert.match(haining.steps.join(' '), /AB10.*EB10/s); assert.match(haining.steps.join(' '), /周四22:00.*未满5人/s); assert.match(haining.troubleshooting.join(' '), /0571-87572114/)
  assert.doesNotMatch(metro.steps.join(' '), /AB10|EB41|周末学生班车/)
  assert.match(metro.steps[0], /惟学书院南侧/); assert.match(metro.steps[1], /地铁站A口/)
  assert.match(metro.steps.join(' '), /周五/); assert.match(metro.steps.join(' '), /周日/)
  assert.match(metro.steps.join(' '), /是否须预约、费用和乘车身份未核实/)
  assert.ok(city.references.every((r) => !r.url.includes('haining')))
  assert.ok(city.references.some((r) => r.url.includes('words=%E7%8F%AD%E8%BD%A6')))
  assert.ok(haining.references.some((r) => r.url === 'https://coc.intl.zju.edu.cn/sites/default/files/ueditor/152/upload/file/20260529/1780034024934789.pdf'))
  assert.ok(metro.references.some((r) => r.url.endsWith('.pdf')))
  const legacyBus = websites.find((site) => site.id === 'website-d131c92460')
  assert.equal(legacyBus.verifiedAt, null); assert.match(legacyBus.summary, /本轮未能读取.*不据此判断.*可用/)
  const car = guides.find((guide) => guide.id === 'campus-113')
  assert.match(car.steps.join(' '), /实时位置、线路和运行时刻表/)
  assert.match(car.steps.join(' '), /1元\/人\/次/); assert.match(car.steps.join(' '), /88206142/)
  assert.match(car.steps.join(' '), /不表示.*保证.*15分钟内到车/)
})
