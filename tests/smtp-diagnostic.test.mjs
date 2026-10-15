import test from 'node:test'
import assert from 'node:assert/strict'
import {createDiagnostic} from '../supabase/tools/smtp-diagnostic.mjs'
import {once} from 'node:events'

test('single-use diagnostic blocks foreign origins, invalid input and credential leakage',async()=>{
 let calls=0
 const server=createDiagnostic(async input=>{calls++;assert.equal(input.password,'abcdefghijklmnop');return {ok:false,stage:'auth',code:'EAUTH',smtpCode:535,secret:'must-not-escape'}})
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port
 try{
  const page=await fetch(url);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(page.headers.get('cache-control'),'no-store')
  const html=await page.text();assert.ok(html.includes('value=password.value.replace(/\\s+/g'));const nonce=html.match(/X-Diagnostic-Nonce':'([a-f0-9]+)'/)[1]
  const body=JSON.stringify({password:'abcdefghijklmnop',recipient:'attacker@invalid.test'})
  const headers={'Content-Type':'application/json','X-Diagnostic-Nonce':nonce,Origin:'https://foreign.invalid'}
  assert.equal((await fetch(url+'/check',{method:'POST',headers,body})).status,403);assert.equal(calls,0)
  headers.Origin=url
  for(const value of [null,{}, {password:'not-a-code'}])assert.equal((await fetch(url+'/check',{method:'POST',headers,body:JSON.stringify(value)})).status,400)
  assert.equal((await fetch(url+'/check',{method:'POST',headers,body})).status,200)
  assert.equal((await fetch(url+'/check',{method:'POST',headers,body})).status,429);assert.equal(calls,1)
  const status=await(await fetch(url+'/status')).text();assert.doesNotMatch(status,/abcdefghijklmnop|must-not-escape|attacker/);assert.equal(JSON.parse(status).latest.smtpCode,535)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})

test('concurrent submits cannot trigger two sends',async()=>{
 let release,calls=0
 const server=createDiagnostic(async()=>{calls++;await new Promise(r=>release=r);return {ok:true,code:'SMTP_ACCEPTED'}})
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port
 try{
  const html=await(await fetch(url)).text();const nonce=html.match(/X-Diagnostic-Nonce':'([a-f0-9]+)'/)[1]
  const request=()=>fetch(url+'/check',{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-Diagnostic-Nonce':nonce},body:JSON.stringify({password:'abcdefghijklmnop'})})
  const pending=request()
  for(let i=0;i<100&&!release;i++)await new Promise(r=>setTimeout(r,5))
  assert.ok(release);assert.equal((await request()).status,429);assert.equal(calls,1);release();assert.equal((await pending).status,200)
 }finally{release?.();server.closeAllConnections();await new Promise(r=>server.close(r))}
})
