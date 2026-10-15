import test from 'node:test'
import assert from 'node:assert/strict'
import { smtp2goTransport } from '../supabase/functions/food-auth-email/smtp2go.ts'
import { createEmailHandler } from '../supabase/functions/food-auth-email/handler.ts'
const options={apiKey:'fixture-only-key',sender:'sender@zju.edu.cn'}
const mail={from:{name:'课程项目',address:options.sender},to:'student-a@zju.edu.cn',subject:'验证码',text:'fixture-only'}
const accepted={data:{succeeded:1,failed:0,failures:[],email_id:'fixture-id'}}
test('HTTPS service accepts different campus recipients, never only the sender',async()=>{
 const calls=[];const transport=smtp2goTransport(options,async(url,init)=>{calls.push({url,init});return Response.json(accepted)})
 for(const to of ['student-a@zju.edu.cn','student-b@zju.edu.cn']) assert.deepEqual(await transport.sendMail({...mail,to}),{accepted:[to],rejected:[]})
 assert.equal(calls.length,2);assert.equal(calls[0].url,'https://api.smtp2go.com/v3/email/send');assert.equal(calls[0].init.redirect,'error')
 assert.deepEqual(JSON.parse(calls[1].init.body).to,['student-b@zju.edu.cn']);assert.equal(JSON.parse(calls[0].init.body).text_body,mail.text)
})
test('non-campus recipient and sender spoof fail before networking',async()=>{
 let calls=0;const t=smtp2goTransport(options,async()=>{calls++;return Response.json(accepted)})
 for(const to of ['x@example.com','x@zju.edu.cn.evil','x@zju.edu.cn\r\nBcc:y@evil.com']) await assert.rejects(t.sendMail({...mail,to}))
 await assert.rejects(t.sendMail({...mail,from:{name:'x',address:'other@zju.edu.cn'}}));assert.equal(calls,0)
})
test('HTTP errors and partial/rejected/malformed success never claim sent',async()=>{
 for(const [status,body] of [[429,{}],[403,{}],[500,{}],[200,{}],[200,{data:{succeeded:0,failed:1,failures:['private detail'],email_id:'x'}}],[200,{data:{...accepted.data,error:'private detail'}}],[200,{data:{email_id:'fastaccept-only'}}]]){
  await assert.rejects(smtp2goTransport(options,async()=>Response.json(body,{status})).sendMail(mail),/SMTP2GO_/)
 }
})
test('closing HTTP transport aborts stalled sends and rejects later sends',async()=>{
 let start;const ready=new Promise(r=>{start=r});const t=smtp2goTransport(options,async(url,init)=>new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(Error('ABORTED')));start()}))
 const sending=t.sendMail(mail);await ready;t.close();await assert.rejects(sending,/ABORTED/);await assert.rejects(t.sendMail(mail),/CLOSED/)
})
function hook(event,{invalid=false,hang=false}={}){
 const sent=[],logs=[];let smtp=0,closed=0
 const env={FOOD_EMAIL_HOOK_SECRET:'fixture-signature',FOOD_EMAIL_PROVIDER:'smtp2go',FOOD_SMTP2GO_API_KEY:'fixture-key',FOOD_EMAIL_FROM:options.sender}
 const handler=createEmailHandler({env:k=>env[k],verify:()=>{if(invalid)throw Error('signature');return event},transport:()=>{smtp++;throw Error('unexpected SMTP')},httpTransport:()=>({sendMail:async m=>{sent.push(m);if(hang)return new Promise(()=>{});return {accepted:[m.to]}},close:()=>{closed++}}),log:e=>logs.push(e)},hang?5:4000)
 return {handler,sent,logs,env,smtp:()=>smtp,closed:()=>closed}
}
const request=()=>new Request('https://fixture.invalid',{method:'POST',body:'{}'})
const payload={user:{email:mail.to},email_data:{email_action_type:'signup',token:'12345678'}}
test('signed Auth payload sends OTP to multiple students without SMTP password',async()=>{
 for(const email of ['student-a@zju.edu.cn','student-b@zju.edu.cn']){
  const h=hook({...payload,user:{email}});assert.equal((await h.handler(request())).status,200);assert.equal(h.sent[0].to,email);assert.equal(h.smtp(),0)
  assert.match(h.sent[0].text,/12345678/);assert.deepEqual(h.logs,[{stage:'smtp2go',code:'ACCEPTED'}]);assert.doesNotMatch(JSON.stringify(h.logs),/12345678|fixture-key|student-/)
 }
})
test('anonymous binding and secure dual-email changes retain correct recipients',async()=>{
 const h=hook({user:{email:'',new_email:mail.to},email_data:{email_action_type:'email_change',token:'12345678'}});assert.equal((await h.handler(request())).status,200);assert.equal(h.sent[0].to,mail.to)
 const dual=hook({user:{email:'student-a@zju.edu.cn',new_email:'student-b@zju.edu.cn'},email_data:{email_action_type:'email_change',token:'12345678',token_new:'87654321',token_hash_new:'old-hash'}})
 assert.equal((await dual.handler(request())).status,200);assert.deepEqual(dual.sent.map(m=>m.to),['student-a@zju.edu.cn','student-b@zju.edu.cn'])
})
test('invalid signature, missing key and unsupported provider cannot send',async()=>{
 const invalid=hook(payload,{invalid:true});assert.equal((await invalid.handler(request())).status,401);assert.equal(invalid.sent.length,0)
 const missing=hook(payload);delete missing.env.FOOD_SMTP2GO_API_KEY;assert.equal((await missing.handler(request())).status,503)
 const unknown=hook(payload);unknown.env.FOOD_EMAIL_PROVIDER='resend-test';assert.equal((await unknown.handler(request())).status,503)
})
test('HTTP timeout cancels request before Auth deadline without fake success',async()=>{
 const h=hook(payload,{hang:true});assert.equal((await h.handler(request())).status,503);assert.ok(h.closed()>=1);assert.deepEqual(h.logs,[{stage:'smtp2go',code:'EMAIL_HTTP_TIMEOUT'}])
})
