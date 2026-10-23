import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { filterGuides, primaryGuideAction } from '../src/lib/campusContent.ts'

const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))
const guides = read('guides')
const websites = read('websites')
const ids = ['postgraduate-recommendation', 'postgraduate-admission', 'undergraduate-scholarships', 'competition-recognition']
const guide = (id) => guides.find((entry) => entry.id === id)
const text = (entry) => [entry.summary, ...entry.steps, ...entry.notes, ...entry.troubleshooting, entry.completionNote].join(' ')

test('官方学业增补独立追溯，保留110条原始问题映射与目录唯一性', () => {
  assert.equal(read('content-manifest').officialSupplementCount, ids.length)
  assert.equal(read('content-manifest').guideCount, guides.length)
  assert.equal(read('content-manifest').websiteCount, websites.length)
  assert.deepEqual(guides.flatMap((entry) => entry.sourceRows).sort((a, b) => a - b), Array.from({ length: 110 }, (_, i) => i + 2))
  for (const id of ids) {
    assert.equal(guides.filter((entry) => entry.id === id).length, 1)
    assert.deepEqual(guide(id).sourceRows, [])
    assert.deepEqual(guide(id).sourceQuestions, [])
    assert.match(guide(id).source, /官方公开文件增补/)
    assert.ok(guide(id).verificationScope)
    for (const reference of guide(id).references) {
      assert.ok(new URL(reference.url).hostname.endsWith('.zju.edu.cn'))
      assert.equal(websites.filter((entry) => entry.url.replace(/\/$/, '') === reference.url.replace(/\/$/, '')).length, 1)
    }
  }
})

test('保研资格、接收、奖学金和竞赛认定查询优先定位各自业务', () => {
  for (const [query, id] of [
    ['保研', 'postgraduate-recommendation'],
    ['推免资格', 'postgraduate-recommendation'],
    ['推免接收', 'postgraduate-admission'],
    ['国家奖学金', 'undergraduate-scholarships'],
    ['竺可桢奖学金', 'undergraduate-scholarships'],
    ['竞赛认定', 'competition-recognition'],
    ['竞赛加分', 'competition-recognition'],
    ['竞赛报名', 'campus-067'],
  ]) assert.equal(filterGuides(guides, query)[0]?.id, id, query)
  assert.ok(guide('postgraduate-recommendation').relatedGuideIds.includes('postgraduate-admission'))
  assert.ok(guide('postgraduate-admission').relatedGuideIds.includes('postgraduate-recommendation'))
  assert.ok(guide('campus-026').relatedGuideIds.includes('competition-recognition'))
  assert.ok(guide('campus-067').relatedGuideIds.includes('competition-recognition'))
})

test('年度申请截止与学院适用边界随指南正文保留', () => {
  const recommendation = guide('postgraduate-recommendation')
  assert.match(text(recommendation), /2026年8月30日16:00.*现已截止/)
  assert.match(text(recommendation), /本院当届细则/)
  const admission = guide('postgraduate-admission')
  assert.match(text(admission), /2026年8月10日至9月10日.*现已截止/)
  assert.match(text(admission), /本科院校推免资格/)
  const scholarships = guide('undergraduate-scholarships')
  assert.match(text(scholarships), /体艺部2026年10月10日12:00.*材料学院10月10日24:00.*现已截止/)
  assert.match(text(scholarships), /二、三等奖.*后续通知/)
  assert.match(text(scholarships), /无法撤回或修改/)
  for (const id of ids) assert.doesNotMatch(text(guide(id)), /全校统一截止|保研包过|自动获得奖学金/)
})

test('竞赛学校认定、学院分值和素拓分别处理，采用仍被2026通知引用的2021依据', () => {
  const competition = guide('competition-recognition')
  assert.match(text(competition), /2026.*2021版/)
  assert.match(text(competition), /废止2018/)
  assert.match(text(competition), /推免、奖学金和素拓学分各自核对/)
  assert.match(text(competition), /团队本人排名/)
  assert.ok(competition.references.some((entry) => entry.url.includes('ugrs.zju.edu.cn') && entry.label.includes('2026通知附件')))
  assert.match(competition.verificationScope, /未逐项核验/)
})

test('动态或登录入口没有冒充已核验业务页面，学业目录关联不混用', () => {
  const directory = websites.find((entry) => entry.url.startsWith('https://yjsy.zju.edu.cn/open/'))
  assert.equal(directory.verifiedAt, null)
  assert.deepEqual(directory.guideIds, ['postgraduate-admission'])
  assert.match(guide('postgraduate-admission').verificationScope, /动态加载页/)
  assert.match(guide('undergraduate-scholarships').verificationScope, /未验证ETA登录后/)
  const eta = websites.find((entry) => entry.url === 'https://eta.zju.edu.cn/')
  assert.ok(eta.guideIds.includes('undergraduate-scholarships'))
  assert.ok(!eta.guideIds.includes('postgraduate-recommendation'))
})

test('2026新生学分与一般FAQ分清适用对象，退补选不沿用过期时段', () => {
  const limit = guide('campus-020')
  assert.match(text(limit), /2026级新生.*30学分.*增加5学分/)
  assert.match(text(limit), /常见问题.*35学分.*40学分.*专门通知/)
  assert.match(text(limit), /已选上课程、待定课程和补选申请课程一起相加/)
  assert.match(text(limit), /毕业班.*例外/)
  const selection = guide('campus-019')
  assert.match(text(selection), /2026年6月.*均已结束/)
  assert.match(text(selection), /第四轮须查看新通知/)
  const changes = guide('campus-022')
  assert.match(text(changes), /均不允许免听时不能冲突补选/)
  assert.match(text(changes), /9月11—13日.*9月14—16日.*9月24—27日.*均已结束/)
  assert.match(text(changes), /每人限申请退一门.*不外推所有轮次/)
  assert.match(text(guide('campus-042')), /跨专业、跨年级.*第一轮.*第二轮/)
})

test('转专业保留年级与专项边界，入口对应教务而非院系历史公示', () => {
  const eligibility = guide('campus-032')
  assert.match(text(eligibility), /强基.*原则上不转专业/)
  assert.match(text(eligibility), /三位一体.*不参加主修专业确认.*高考投档成绩/)
  assert.match(text(eligibility), /不同中外合作联合学院之间也不能互转/)
  assert.match(text(eligibility), /历史学院2025细则.*2023\/2024级/)
  assert.match(eligibility.verificationScope, /校级2026转专业通知直接读取失败/)
  const application = guide('campus-033')
  assert.match(text(application), /学籍管理→转专业申请/)
  assert.match(text(application), /提交成功仍需审核/)
  assert.match(text(application), /后续申请须使用新学期安排/)
  assert.equal(primaryGuideAction(eligibility)?.url, 'https://zdbk.zju.edu.cn/')
  assert.equal(primaryGuideAction(application)?.url, 'https://zdbk.zju.edu.cn/')
})

test('推免细则增补学校框架与院系要求，资格申请与接收仍分开', () => {
  const recommendation = guide('postgraduate-recommendation')
  assert.match(text(recommendation), /学校2023.*学业\/素质评价/)
  assert.match(text(recommendation), /有效学分达到125.*该院当届要求/)
  assert.match(text(recommendation), /素质评价总分上限1.0/)
  assert.match(text(recommendation), /本研贯通.*特殊培养/)
  assert.ok(recommendation.references.some((ref) => ref.url.endsWith('01-1693813526-208542.pdf')))
  assert.equal(filterGuides(guides, '推免细则')[0]?.id, recommendation.id)
})

test('学生项目报销保留独立流程、用途授权和业务附件，不把立项当到账', () => {
  const project = guide('campus-028').routes.find((route) => route.id === 'srtp-reimbursement')
  assert.match(project.steps.join(' '), /入库单.*自购备案/)
  assert.match(project.troubleshooting.join(' '), /本科教学科.*分期拨款.*余额/)
  assert.match(project.completionNote, /送审和审核中均属办理过程/)
  assert.match(text(guide('campus-111')), /当年票据原则上当年报销.*年末.*当年通知/)
  assert.match(text(guide('campus-112')), /5月申报已截止/)
  assert.ok(guide('campus-111').relatedGuideIds.includes('campus-112'))
  assert.ok(guide('campus-112').relatedGuideIds.includes('campus-111'))
})
