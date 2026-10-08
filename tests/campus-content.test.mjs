import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { filterGuides, filterAccounts, filterWebsites } from '../src/lib/campusContent.ts'
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
  assert.ok(filterGuides(guides, '青溪翠柏').some((guide) => guide.title === '快递点'))
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