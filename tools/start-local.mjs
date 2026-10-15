import {spawn} from 'node:child_process'
import {mkdir,open,readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'

const root=fileURLToPath(new URL('../',import.meta.url))
const url='http://127.0.0.1:4175/food/login'
async function reachable(){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(1500)})
  const html=await response.text()
  const expected=await readFile(join(root,'dist/index.html'),'utf8')
  const title=expected.match(/<title>[^<]+<\/title>/)?.[0]
  return response.ok&&!!title&&html.includes(title)&&html.includes('id="root"')
 }catch{return false}
}
if(await reachable()){
 console.log('Local site is already available: '+url)
}else{
 try{await readFile(join(root,'dist/index.html'))}catch{throw Error('Build missing. Run npm run build before starting the preview.')}
 await mkdir(join(root,'scratch'),{recursive:true})
 const out=await open(join(root,'scratch/local-preview.stdout.log'),'a')
 const err=await open(join(root,'scratch/local-preview.stderr.log'),'a')
 try{
  const child=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4175','--strictPort'],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out.fd,err.fd]})
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)})
  child.unref()
 }finally{await out.close();await err.close()}
 let ready=false
 for(let attempt=0;attempt<20;attempt++){
  if(await reachable()){ready=true;break}
  await new Promise(resolve=>setTimeout(resolve,250))
 }
 if(!ready)throw Error('Preview did not become available. Inspect scratch/local-preview.stderr.log; another process may own port 4175.')
 console.log('Local site started independently: '+url)
}
