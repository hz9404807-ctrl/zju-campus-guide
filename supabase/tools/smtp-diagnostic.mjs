import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
export function createDiagnostic(python, check = runCheck) {
  const nonce = randomBytes(24).toString('hex')
  let latest = null, attempts = 0, busy = false
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'` }
  const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQ发信认证检查</title><style>body{font:18px/1.7 system-ui;max-width:650px;margin:60px auto;padding:24px;color:#243047}label,input,button{display:block}input{box-sizing:border-box;width:100%;padding:12px;font:inherit;margin:6px 0 20px;border:1px solid #aab6c9;border-radius:8px}button{padding:12px 24px;font:inherit;background:#365cac;color:white;border:0;border-radius:8px}button:disabled{opacity:.5}p{color:#526079}pre{white-space:pre-wrap}</style><h1>QQ发信认证检查</h1><p>此页只在你的电脑运行。只连接QQ服务器验证SMTP登录，不发邮件，不保存授权码，也不修改Supabase。</p><form id="form"><label for="email">开启SMTP的QQ邮箱</label><input id="email" type="email" value="zhx20070808@qq.com" required><label for="password">该邮箱生成的SMTP授权码</label><input id="password" type="password" autocomplete="off" required><button id="submit">检查一次SMTP登录</button></form><p>请直接在本页输入，无需发到聊天。一次运行最多检查两次。</p><pre id="result" role="status"></pre><script nonce="${nonce}">const form=document.getElementById('form'),button=document.getElementById('submit'),result=document.getElementById('result');form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;result.textContent='正在通过加密连接检查，约需几秒…';const password=document.getElementById('password');const body=JSON.stringify({email:document.getElementById('email').value.trim().toLowerCase(),password:password.value.trim()});password.value='';try{const r=await fetch('/check',{method:'POST',headers:{'Content-Type':'application/json','X-Diagnostic-Nonce':'${nonce}'},body});const data=await r.json();result.textContent=data.ok?'本机QQ SMTP登录成功（235）。请回复“本机检查成功”，无需发送授权码。':data.code===535?'本机也返回535：QQ尚未接受这组邮箱与授权码。请回复“本机535”。':'检查未通过：'+(data.code||'UNKNOWN')+'。请回复这一结果。'}catch{result.textContent='诊断连接中断，请告知维护者。'}finally{button.disabled=false}});</script></html>`
  const json = (res, status, data) => { res.writeHead(status, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
  const server = http.createServer(async (req,res) => {
    const origin = `http://127.0.0.1:${server.address().port}`
    if (req.headers.host !== origin.slice(7)) return json(res,403,{code:'HOST_DENIED'})
    if (req.method === 'GET' && req.url === '/') { res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});res.end(page);return }
    if (req.method === 'GET' && req.url === '/status') return json(res,200,{latest,attempts,busy})
    if (req.method !== 'POST' || req.url !== '/check') return json(res,404,{code:'NOT_FOUND'})
    const supplied = Buffer.from(String(req.headers['x-diagnostic-nonce']||''))
    const expected = Buffer.from(nonce)
    if (req.headers.origin !== origin || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return json(res,403,{code:'ORIGIN_DENIED'})
    if (busy || attempts>=2) return json(res,429,{code:'CHECK_LIMIT'})
    let body='', input
    try { for await (const part of req) {body+=part;if(Buffer.byteLength(body)>2048)return json(res,413,{code:'BODY_LIMIT'})} input=JSON.parse(body) } catch {return json(res,400,{code:'INVALID_INPUT'})}
    if (typeof input.email!=='string'||!/^[^\s@<>,;]+@qq\.com$/.test(input.email)||typeof input.password!=='string'||!input.password||input.password.length>128||/[\r\n]/.test(input.password))return json(res,400,{code:'INVALID_INPUT'})
    attempts++;busy=true
    try { latest=await check(python,input);json(res,200,latest);console.log(JSON.stringify({stage:'smtp-check',...latest})) }catch{latest={ok:false,code:'CHECK_FAILED'};json(res,500,latest)}finally{input.password='';body='';input=null;busy=false}
  })
  return server
}
function runCheck(python,input) {
  return new Promise((resolveResult,reject)=>{
    const child=spawn(python,[fileURLToPath(new URL('./smtp-auth-check.py',import.meta.url))],{stdio:['pipe','pipe','ignore'],windowsHide:true})
    let output='';const timer=setTimeout(()=>{child.kill();reject(Error('TIMEOUT'))},12000)
    child.stdout.on('data',part=>{output+=part;if(output.length>2048)child.kill()})
    child.on('error',()=>{clearTimeout(timer);reject(Error('PROCESS_ERROR'))})
    child.on('close',()=>{clearTimeout(timer);try{const raw=JSON.parse(output);resolveResult({ok:raw.ok===true,stage:raw.stage,code:raw.code,tls:raw.tls,method:raw.method})}catch{reject(Error('RESULT_ERROR'))}})
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(input))
  })
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const python=process.argv[2];if(!python)throw Error('Python runtime path required')
 const method=process.argv[3]||'PLAIN';if(!['PLAIN','LOGIN'].includes(method))throw Error('Unsupported auth method')
 const server=createDiagnostic(python,(runtime,input)=>runCheck(runtime,{...input,method}));server.listen(0,'127.0.0.1',()=>console.log('DIAGNOSTIC_URL=http://127.0.0.1:'+server.address().port))
 setTimeout(()=>server.close(),20*60*1000).unref()
}
