import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {unifiedSearch, unifiedGuideUrl, safeHomeReturn, canonicalDestination} from '../src/lib/unifiedSearch.ts'
const read=name=>JSON.parse(readFileSync(new URL(`../src/data/${name}.json`,import.meta.url),'utf8'))
const data={guides:read('guides'),websites:read('websites'),accounts:read('accounts'),windows:read('service-windows')}
test('成绩单优先实际指南且官方关联入口保留办理说明',()=>{
  const result=unifiedSearch('成绩单',data)
  assert.ok(result.guides[0].title.includes('成绩单'))
  assert.ok(result.websites.length)
  assert.ok(result.websites.every(s=>s.scope==='学校域名' && s.details.summary))
  const url=new URL(unifiedGuideUrl(result.guides[0],'成绩单'),'https://local.invalid')
  assert.equal(new URL(url.searchParams.get('returnTo'),'https://local.invalid').searchParams.get('q'),'成绩单')
})
test('重复ID和同一官方URL含尾斜线/片段只出现一次',()=>{
  const site=data.websites.find(s=>s.scope==='学校域名' && s.guideIds.includes(unifiedSearch('成绩单',data).guides[0].id))
  const result=unifiedSearch('成绩单',{...data,guides:[...data.guides,...data.guides],accounts:[...data.accounts,...data.accounts],websites:[...data.websites,{...site,id:'duplicate',url:site.url.replace(/\/$/,'')+'/#part'}]})
  assert.equal(new Set(result.guides.map(g=>g.id)).size,result.guides.length)
  assert.equal(new Set(result.accounts.map(a=>a.id)).size,result.accounts.length)
  assert.equal(new Set(result.websites.map(s=>canonicalDestination(s.url))).size,result.websites.length)
})
test('空关键词不遍历展示全部，未知条件不伪装准确匹配',()=>{
  assert.equal(unifiedSearch('  ',data).guides.length,0)
  const r=unifiedSearch('成绩单火星量子999',data)
  assert.equal(r.guides.length,0)
  assert.ok(r.suggestions.length)
  assert.equal(unifiedSearch('不存在xyz999',data).websites.length,0)
})
test('首页返回仅保留首页搜索词，拒绝任意跳转与凭据',()=>{
  for(const v of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/food?returnTo=/','javascript:alert(1)'])assert.equal(safeHomeReturn(v),null)
  assert.equal(safeHomeReturn('/?q=a&token=secret&returnTo=https://evil.invalid'),'/?q=a#home-search')
})
