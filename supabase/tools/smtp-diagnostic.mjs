import http from 'node:http'
import {randomBytes,timingSafeEqual} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {runIsolatedMailCheck,SENDER,RECIPIENT} from './smtp-mail-check.mjs'

export function createDiagnostic(check=runIsolatedMailCheck){
 const nonce=randomBytes(24).toString('hex')
 let latest=null,attempts=0,busy=false
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'`}
 const page=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>校园指南：单次发信检查</title><style>body{font:18px/1.7 system-ui;max-width:650px;margin:40px auto;padding:24px;color:#243047}label,input,button{display:block}input{box-sizing:border-box;width:100%;padding:12px;font:inherit;margin:8px 0 20px;border:1px solid #aab6c9;border-radius:8px}button{padding:12px 24px;font:inherit;background:#365cac;color:white;border:0;border-radius:8px}button:disabled{opacity:.5}p{color:#526079}pre{white-space:pre-wrap}</style><h1>单次发信检查</h1><p>发件：${SENDER}<br>收件：${RECIPIENT}<br>方式：QQ SMTP 465 加密连接 · AUTH LOGIN · Nodemailer</p><p>仅在本机临时使用现有授权码，不保存、不修改Supabase。认证通过后才发送一封测试邮件；失败不自动重试。</p><form id="form"><label for="password">QQ SMTP授权码</label><input id="password" type="password" autocomplete="off" spellcheck="false" required><button id="submit">认证并发送一封测试邮件</button></form><pre id="result" role="status"></pre><script nonce="${nonce}">const form=document.getElementById('form'),button=document.getElementById('submit'),result=document.getElementById('result');form.addEventListener('submit',async e=>{e.preventDefault();const password=document.getElementById('password'),value=password.value.replace(/\\s+/g,'');if(!/^[A-Za-z]{16}$/.test(value)){result.textContent='授权码应为16个英文字母，可包含分组空格。请确认没有填QQ密码，无需重新生成。';return}button.disabled=true;result.textContent='正在连接、认证并发送，最多等待约30秒。请不要重复点击。';const body=JSON.stringify({password:value});password.value='';try{const response=await fetch('/check',{method:'POST',headers:{'Content-Type':'application/json','X-Diagnostic-Nonce':'${nonce}'},body});const data=await response.json();if(data.code==='AUTH_CODE_FORMAT'){button.disabled=false;result.textContent='授权码格式不符，尚未连接QQ。';return}result.textContent=data.ok?'QQ已接受测试邮件。请检查浙大邮箱收件箱和垃圾邮件，回复“已收到测试邮件”或“未收到”。这还不代表网站登录已开通。':data.smtpCode===535?'QQ认证返回535；未发送邮件。已停止，不再自动重试。':data.outcomeUnknown?'连接或发送超时，投递状态可能不确定。已停止，不重复发送；请反馈此提示。':'检查停止：阶段 '+(data.stage||'local')+'，错误 '+(data.code||'UNKNOWN')+(data.smtpCode?'，SMTP '+data.smtpCode:'')+'。无需重新输入。'}catch{result.textContent='本机页面连接中断，实际发送状态未知。不要重复发送，请告知维护者。'}});</script></html>`
 const json=(res,status,data)=>{res.writeHead(status,{...headers,'Content-Type':'application/json'});res.end(JSON.stringify(data))}
 const server=http.createServer(async(req,res)=>{
  const origin='http://127.0.0.1:'+server.address().port
  if(req.headers.host!==origin.slice(7))return json(res,403,{code:'HOST_DENIED'})
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});res.end(page);return}
  if(req.method==='GET'&&req.url==='/status')return json(res,200,{latest,attempts,busy})
  if(req.method!=='POST'||req.url!=='/check')return json(res,404,{code:'NOT_FOUND'})
  const supplied=Buffer.from(String(req.headers['x-diagnostic-nonce']||'')),expected=Buffer.from(nonce)
  if(req.headers.origin!==origin||supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return json(res,403,{code:'ORIGIN_DENIED'})
  let body='',input
  try{for await(const part of req){body+=part;if(Buffer.byteLength(body)>2048)return json(res,413,{code:'BODY_LIMIT'})}input=JSON.parse(body)}catch{return json(res,400,{code:'INVALID_INPUT'})}
  if(!input||typeof input.password!=='string'||! /^[A-Za-z]{16}$/.test(input.password.replace(/\s+/g,'')))return json(res,400,{code:'AUTH_CODE_FORMAT'})
  if(busy||attempts>=1)return json(res,429,{code:'CHECK_LIMIT'})
  attempts++;busy=true
  try{const raw=await check(input);latest={ok:raw.ok===true,stage:raw.stage,code:raw.code,smtpCode:raw.smtpCode,auth:raw.auth,method:raw.method,outcomeUnknown:raw.outcomeUnknown};json(res,200,latest)}catch{latest={ok:false,stage:'local',code:'CLIENT_ERROR'};json(res,500,latest)}finally{input.password='';body='';busy=false}
 })
 return server
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const server=createDiagnostic();server.listen(0,'127.0.0.1',()=>console.log('DIAGNOSTIC_URL=http://127.0.0.1:'+server.address().port))
 setTimeout(()=>server.close(),20*60*1000).unref()
}
