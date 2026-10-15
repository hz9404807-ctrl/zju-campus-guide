import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import {once} from 'node:events'
import nodemailer from 'nodemailer'
import {runMailCheck,runIsolatedMailCheck,SENDER,RECIPIENT} from '../supabase/tools/smtp-mail-check.mjs'

async function fixture(rejectAuth,run){
 const transcript=[];const sockets=new Set();let messages=0
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{})
  let buffer='',mode='command'
  socket.write('220 offline-test ESMTP\r\n')
  socket.on('data',chunk=>{
   buffer+=chunk.toString()
   while(buffer.includes('\r\n')){
    const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2)
    if(mode==='data'){if(line==='.') {messages++;mode='command';socket.write('250 queued fixture\r\n')}continue}
    transcript.push(line)
    if(mode==='username'){assert.equal(Buffer.from(line,'base64').toString(),SENDER);mode='password';socket.write('334 UGFzc3dvcmQ6\r\n');continue}
    if(mode==='password'){assert.equal(Buffer.from(line,'base64').toString(),'abcdefghijklmnop');mode='command';socket.write(rejectAuth?'535 rejected\r\n':'235 authenticated\r\n');continue}
    if(/^EHLO/.test(line))socket.write('250-offline-test\r\n250 AUTH LOGIN PLAIN\r\n')
    else if(line==='AUTH LOGIN'){mode='username';socket.write('334 VXNlcm5hbWU6\r\n')}
    else if(/^MAIL FROM:/.test(line))socket.write('250 ok\r\n')
    else if(/^RCPT TO:/.test(line))socket.write('250 ok\r\n')
    else if(line==='DATA'){mode='data';socket.write('354 continue\r\n')}
    else if(line==='QUIT'){socket.end('221 bye\r\n')}
    else socket.write('500 unexpected\r\n')
   }
  })
 })
 server.listen(0,'127.0.0.1');await once(server,'listening')
 try{
  await run(options=>{
   assert.equal(options.host,'smtp.qq.com');assert.equal(options.port,465);assert.equal(options.secure,true);assert.equal(options.authMethod,'LOGIN');assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.logger,false);assert.equal(options.debug,false)
   // Only the test factory redirects to an offline plaintext fixture.
   return nodemailer.createTransport({...options,host:'127.0.0.1',port:server.address().port,secure:false,ignoreTLS:true})
  },transcript,()=>messages)
 }finally{for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r))}
}

test('real Nodemailer LOGIN succeeds before one fixed-recipient message',()=>fixture(false,async(factory,transcript,messages)=>{
 const input={password:'abcd efgh ijkl mnop',recipient:'attacker@invalid.test'}
 const result=await runMailCheck(input,factory)
 assert.equal(result.code,'SMTP_ACCEPTED');assert.equal(input.password,'');assert.equal(messages(),1)
 assert.equal(transcript.filter(line=>line==='AUTH LOGIN').length,1)
 assert.deepEqual(transcript.filter(line=>line.startsWith('RCPT TO:')),[`RCPT TO:<${RECIPIENT}>`])
 assert.ok(transcript.indexOf('AUTH LOGIN')<transcript.findIndex(line=>line.startsWith('MAIL FROM:')))
}))

test('real Nodemailer 535 stops before MAIL/DATA with no sensitive error output',()=>fixture(true,async(factory,transcript,messages)=>{
 const result=await runMailCheck({password:'abcdefghijklmnop'},factory)
 assert.equal(result.smtpCode,535);assert.equal(result.stage,'auth');assert.equal(messages(),0)
 assert.equal(transcript.filter(line=>line.startsWith('MAIL FROM:')).length,0)
 assert.doesNotMatch(JSON.stringify(result),/abcdefghijklmnop|rejected|qq.com/)
}))

test('invalid authorization-code characters never open a connection',async()=>{
 let calls=0;const result=await runMailCheck({password:'bad-中'},()=>{calls++})
 assert.equal(result.code,'AUTH_CODE_FORMAT');assert.equal(calls,0)
})

test('deadline closes client without automatic retry and marks delivery uncertain',async()=>{
 let closed=0,sends=0
 const result=await runMailCheck({password:'abcdefghijklmnop'},()=>({sendMail(){sends++;return new Promise(()=>{})},close(){closed++}}),20)
 assert.equal(result.code,'TIMEOUT');assert.equal(result.outcomeUnknown,true);assert.equal(sends,1);assert.equal(closed,1)
})

test('isolated worker reports invalid input without connecting and clears parent reference',async()=>{
 const input={password:'invalid'};const result=await runIsolatedMailCheck(input)
 assert.equal(result.code,'AUTH_CODE_FORMAT');assert.equal(input.password,'')
})
