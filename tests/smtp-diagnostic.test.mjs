import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiagnostic } from '../supabase/tools/smtp-diagnostic.mjs'
import { once } from 'node:events'
test('diagnostic stays on loopback, blocks foreign origins and never exposes credentials in status',async()=>{
 let calls=0
 const server=createDiagnostic('unused',async(python,input)=>{calls++;assert.equal(input.password,'fixture-only');return {ok:false,stage:'auth',code:535}})
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port
 try{
  assert.equal(server.address().address,'127.0.0.1')
  const page=await fetch(url);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(page.headers.get('cache-control'),'no-store')
  const html=await page.text();const nonce=html.match(/X-Diagnostic-Nonce':'([a-f0-9]+)'/)[1]
  const body=JSON.stringify({email:'fixture@qq.com',password:'fixture-only'})
  const headers={'Content-Type':'application/json','X-Diagnostic-Nonce':nonce,Origin:'https://foreign.invalid'}
  assert.equal((await fetch(url+'/check',{method:'POST',headers,body})).status,403);assert.equal(calls,0)
  headers.Origin=url
  assert.equal((await fetch(url+'/check',{method:'POST',headers,body:JSON.stringify({email:'fixture@other.invalid',password:'fixture-only'})})).status,400);assert.equal(calls,0)
  for(let i=0;i<2;i++)assert.equal((await fetch(url+'/check',{method:'POST',headers,body})).status,200)
  assert.equal((await fetch(url+'/check',{method:'POST',headers,body})).status,429);assert.equal(calls,2)
  const status=await(await fetch(url+'/status')).text();assert.doesNotMatch(status,/fixture-only|fixture@qq/);assert.equal(JSON.parse(status).latest.code,535)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})
