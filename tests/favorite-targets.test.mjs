import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {guideFavoriteContext,staticFavoriteTarget} from '../src/lib/favoriteTargets.ts'
const read=n=>JSON.parse(readFileSync(new URL(`../src/data/${n}.json`,import.meta.url),'utf8'))
const guides=read('guides'),sites=read('websites'),windows=read('service-windows')
const favorite=(target_kind,target_id,context={})=>({target_kind,target_id,context,created_at:'2026-10-20T00:00:00Z'})
test('指南收藏仅保存有效路线及该路线的校区，不保存私人关键词或任意返回URL',()=>{
  const guide=guides.find(g=>g.routes?.some(r=>r.serviceWindowIds.some(id=>windows.find(w=>w.id===id)?.campus==='紫金港')))
  const route=guide.routes.find(r=>r.serviceWindowIds.some(id=>windows.find(w=>w.id===id)?.campus==='紫金港'))
  const p=new URLSearchParams({route:route.id,campus:'紫金港',q:'我的私人问题',returnTo:'https://evil.invalid',token:'secret'})
  assert.deepEqual(guideFavoriteContext(guide,p,windows),{route:route.id,campus:'紫金港'})
  assert.deepEqual(guideFavoriteContext(guide,new URLSearchParams({route:'invalid-old',campus:'不存在'}),windows),{})
})
test('旧路线失效后不保留错误选中状态，指南改名取最新数据',()=>{
  const guide=guides[0]
  const target=staticFavoriteTarget(favorite('guide',guide.id,{route:'obsolete',campus:'火星'}),[{...guide,title:'当前名称'}],sites,windows)
  assert.equal(target.title,'当前名称');assert.ok(target.notice);assert.equal(target.to,`/guides/${guide.id}`)
})
test('收藏失效目标返回空，所有链接由ID构造站内路径',()=>{
  assert.equal(staticFavoriteTarget(favorite('guide','missing'),guides,sites,windows),null)
  assert.equal(staticFavoriteTarget(favorite('website','https://evil.invalid'),guides,sites,windows),null)
  assert.equal(staticFavoriteTarget(favorite('food','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),guides,sites,windows),null)
  const site=sites.find(s=>s.scope==='学校域名')
  assert.equal(staticFavoriteTarget(favorite('website',site.id),guides,[{...site,url:'https://updated.zju.edu.cn'}],windows).to,`/sites/${site.id}`)
})
test('上下文字段顺序不产生假失效提示，指南别名重定向当前ID',()=>{
  const guide=guides.find(g=>g.routes?.some(r=>r.serviceWindowIds?.length))
  const route=guide.routes.find(r=>r.serviceWindowIds?.length)
  const campus=windows.find(w=>route.serviceWindowIds.includes(w.id))?.campus
  const item=favorite('guide','old-guide-id',{campus,route:route.id})
  const target=staticFavoriteTarget(item,[{...guide,aliases:['old-guide-id']}],sites,windows)
  assert.equal(target.notice,'');assert.ok(target.to.startsWith(`/guides/${guide.id}?`))
})
