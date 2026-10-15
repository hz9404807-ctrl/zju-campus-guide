import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import nodemailer from 'nodemailer'

export const SENDER = 'zhx20070808@qq.com'
export const RECIPIENT = '3250103966@zju.edu.cn'
const SAFE_CODES = new Set(['EAUTH','ETIMEDOUT','ECONNECTION','ESOCKET','EDNS','EENVELOPE','EMESSAGE','EPROTOCOL'])

export async function runMailCheck(input, createTransport = nodemailer.createTransport, deadlineMs = 30000) {
  const secret = input.password.replace(/\s+/g, '')
  if (!/^[A-Za-z]{16}$/.test(secret)) return {ok:false,stage:'input',code:'AUTH_CODE_FORMAT'}
  const options = {
    host:'smtp.qq.com', port:465, secure:true, authMethod:'LOGIN',
    auth:{user:SENDER,pass:secret}, tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,servername:'smtp.qq.com'},
    connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,dnsTimeout:8000,
    pool:false,logger:false,debug:false,transactionLog:false,
    disableFileAccess:true,disableUrlAccess:true,maxRecipients:1
  }
  let transport, timer
  try {
    transport = createTransport(options)
    const send = transport.sendMail({
      from:{name:'浙大校园指南课程项目',address:SENDER},to:RECIPIENT,
      subject:'校园指南发信链路检查（非登录验证码）',
      text:'这是一封由你主动触发的发信测试邮件，不是登录验证码。收到本邮件仅证明本机QQ发信链路可用；网站登录还需单独验证。',
      disableFileAccess:true,disableUrlAccess:true
    })
    const info = await Promise.race([send,new Promise((_,reject)=>{
      timer=setTimeout(()=>{const error=new Error('deadline');error.code='LOCAL_DEADLINE';reject(error)},deadlineMs)
    })])
    const accepted = info.accepted?.length===1 && String(info.accepted[0]).toLowerCase()===RECIPIENT && !info.rejected?.length
    return {ok:accepted,stage:'send',code:accepted?'SMTP_ACCEPTED':'RECIPIENT_NOT_ACCEPTED',auth:'passed',method:'LOGIN'}
  } catch(error) {
    const code=error.code==='LOCAL_DEADLINE'?'TIMEOUT':SAFE_CODES.has(error.code)?error.code:'CLIENT_ERROR'
    const smtpCode=Number.isInteger(error.responseCode)?error.responseCode:undefined
    const command=String(error.command||'').toUpperCase()
    const stage=code==='EAUTH'||command.startsWith('AUTH')?'auth':command.startsWith('MAIL')||command.startsWith('RCPT')||command==='DATA'?'send':'connection'
    return {ok:false,stage,code,smtpCode,method:'LOGIN',outcomeUnknown:code==='TIMEOUT'||code==='ETIMEDOUT'}
  } finally {
    clearTimeout(timer)
    if(transport){transport.close();if(transport.options?.auth)transport.options.auth.pass=''}
    options.auth.pass='';input.password=''
  }
}

// Isolate real checks so the process deadline also tears down active SMTP sockets.
export function runIsolatedMailCheck(input){
 return new Promise(resolve=>{
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--worker'],{stdio:['pipe','pipe','ignore'],windowsHide:true})
  let output='',done=false
  const finish=result=>{if(done)return;done=true;clearTimeout(timer);child.kill();input.password='';resolve(result)}
  const timer=setTimeout(()=>finish({ok:false,stage:'connection',code:'TIMEOUT',method:'LOGIN',outcomeUnknown:true}),31000)
  child.on('error',()=>finish({ok:false,stage:'local',code:'CLIENT_PROCESS_ERROR'}))
  child.stdout.on('data',part=>{output+=part;if(output.length>2048)finish({ok:false,stage:'local',code:'CLIENT_RESULT_ERROR'})})
  child.on('close',()=>{try{finish(JSON.parse(output))}catch{finish({ok:false,stage:'local',code:'CLIENT_RESULT_ERROR',outcomeUnknown:true})}})
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({password:input.password}))
 })
}
if(process.argv[2]==='--worker'){
 let body=''
 try{
  for await(const chunk of process.stdin){body+=chunk;if(Buffer.byteLength(body)>2048)throw Error('INPUT_LIMIT')}
  const result=await runMailCheck(JSON.parse(body));body=''
  process.stdout.write(JSON.stringify(result),()=>process.exit(0))
 }catch{process.stdout.write(JSON.stringify({ok:false,stage:'local',code:'CLIENT_WORKER_ERROR'}),()=>process.exit(1))}
}
