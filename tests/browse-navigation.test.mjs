import test from 'node:test'
import assert from 'node:assert/strict'
import { guideNavigation, sourceGuideUrl } from '../src/lib/browseNavigation.ts'

const origin = 'https://campus-guide.invalid'

test('网站分类、页码留在来源列表，不污染指南筛选；刷新后的返回仍可恢复', () => {
  const source = new URLSearchParams({ kind: 'websites', q: '海宁班车', category: '校园交通', page: '2' })
  const detail = new URL(sourceGuideUrl('campus-077', source, '海宁班车', 'haining-intercampus'), origin)
  assert.equal(detail.pathname, '/guides/campus-077')
  assert.equal(detail.searchParams.get('route'), 'haining-intercampus')
  assert.equal(detail.searchParams.get('q'), '海宁班车')
  for (const key of ['kind', 'category', 'page']) assert.equal(detail.searchParams.has(key), false)
  const navigation = guideNavigation(new URLSearchParams(detail.search))
  const back = new URL(navigation.backTo, origin)
  assert.equal(back.pathname, '/sources')
  assert.deepEqual(Object.fromEntries(back.searchParams), Object.fromEntries(source))
  assert.equal(navigation.backLabel, '信息源列表')
})

test('搜索正在更新时，详情及返回地址使用实际显示结果对应的查询', () => {
  const params = new URLSearchParams({ kind: 'websites', q: '新输入的词', category: '校园交通' })
  const url = new URL(sourceGuideUrl('campus-077', params, '海宁班车'), origin)
  assert.equal(url.searchParams.get('q'), '海宁班车')
  assert.equal(new URL(url.searchParams.get('returnTo'), origin).searchParams.get('q'), '海宁班车')
  assert.equal(params.get('q'), '新输入的词')
})

test('中文、空格和查询符号能够在跨栏目往返后保持原意', () => {
  const query = '图书馆 座位 & ?校区=玉泉#自习'
  const source = new URLSearchParams({ kind: 'websites', q: query })
  const detail = new URL(sourceGuideUrl('campus-111', source, query, 'seat'), origin)
  const back = new URL(guideNavigation(detail.searchParams).backTo, origin)
  assert.equal(back.searchParams.get('q'), query)
  assert.equal(detail.searchParams.get('route'), 'seat')
})

test('旧网站详情链接也回到信息源，不再把校园交通当指南分类', () => {
  const navigation = guideNavigation(new URLSearchParams('kind=websites&category=校园交通&page=2&q=班车&route=haining&busDay=weekdays'))
  const back = new URL(navigation.backTo, origin)
  assert.equal(back.pathname, '/sources')
  assert.equal(back.searchParams.get('category'), '校园交通')
  assert.equal(back.searchParams.get('page'), '2')
  assert.equal(back.searchParams.has('route'), false)
  assert.equal(back.searchParams.has('busDay'), false)
  assert.deepEqual([...new URLSearchParams(navigation.relatedSearch).keys()], ['q', 'returnTo'])
})

test('正常指南往返保留指南查询、分类与页码，剥离详情专属参数', () => {
  const navigation = guideNavigation(new URLSearchParams('q=校园卡&category=校园卡&page=2&route=window&busFrom=玉泉&busDay=weekdays'))
  assert.equal(navigation.backLabel, '搜索结果')
  assert.deepEqual(Object.fromEntries(new URL(navigation.backTo, origin).searchParams), { q: '校园卡', category: '校园卡', page: '2' })
  assert.equal(navigation.relatedSearch, navigation.backTo.slice('/guides'.length))
  assert.equal(guideNavigation(new URLSearchParams()).backTo, '/guides')
})

test('返回地址只接受本站信息源列表，拒绝外站、协议相对地址、反斜杠和其他路由', () => {
  for (const value of ['https://outside.invalid/sources', '//outside.invalid/sources', '/\\outside.invalid/sources', 'javascript:alert(1)', '/sources/other', '/sources/../account', '/account', '/sources\n?kind=websites']) {
    const params = new URLSearchParams({ q: '班车', returnTo: value })
    assert.equal(guideNavigation(params).backTo, '/guides?q=%E7%8F%AD%E8%BD%A6', value)
    assert.equal(new URLSearchParams(guideNavigation(params).relatedSearch).has('returnTo'), false)
  }
})

test('返回地址不嵌套增长，相关指南继续保留原来源列表', () => {
  const params = new URLSearchParams({ q: '班车', returnTo: '/sources?kind=websites&category=校园交通&returnTo=https://outside.invalid#source-results-heading' })
  const first = guideNavigation(params)
  assert.equal(new URL(first.backTo, origin).searchParams.has('returnTo'), false)
  assert.equal(new URL(first.backTo, origin).hash, '#source-results-heading')
  let related = first.relatedSearch
  for (let index = 0; index < 5; index++) {
    const next = guideNavigation(new URLSearchParams(related))
    assert.equal(next.backTo, first.backTo)
    assert.equal(next.relatedSearch, related)
    related = next.relatedSearch
  }
})
