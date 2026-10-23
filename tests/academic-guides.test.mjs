import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { filterGuides } from '../src/lib/campusContent.ts'

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
