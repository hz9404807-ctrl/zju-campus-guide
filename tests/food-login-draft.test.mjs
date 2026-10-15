import test from 'node:test'
import assert from 'node:assert/strict'
import {readFoodLoginDraft,saveFoodLoginDraft,clearFoodLoginDraft,loginDraftCooldown} from '../src/lib/foodLoginDraft.ts'
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map}}
const draft={email:'fixture@zju.edu.cn',type:'email_change',delivery:'accepted',mode:'bind',ownerId:'anonymous-owner',sentAt:100000}

test('reopening login restores the correct binding type and remaining cooldown without saving the OTP',()=>{
 const store=storage();saveFoodLoginDraft(store,{...draft,token:'12345678',access_token:'secret-session'})
 assert.deepEqual(readFoodLoginDraft(store,draft.ownerId,120000),draft)
 assert.equal(loginDraftCooldown(draft.sentAt,120000),40)
 assert.doesNotMatch([...store.map.values()][0],/12345678|secret-session|access_token|token/)
})
test('a different identity cannot restore a previous owner binding',()=>{
 for(const owner of [null,'different-owner']){const store=storage();saveFoodLoginDraft(store,draft);assert.equal(readFoodLoginDraft(store,owner,120000),null);assert.equal(store.map.size,0)}
})
test('expired, future, invalid-domain and inconsistent binding drafts are discarded',()=>{
 for(const [value,now] of [[draft,1900000],[{...draft,sentAt:2000000},120000],[{...draft,email:'x@evil.test'},120000],[{...draft,ownerId:null},120000],[{...draft,mode:'login'},120000]]){
  const store=storage();saveFoodLoginDraft(store,value);assert.equal(readFoodLoginDraft(store,value.ownerId,now),null)
 }
})
test('storage failure or malformed data never blocks login and clear removes request metadata',()=>{
 const broken={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}}
 assert.doesNotThrow(()=>saveFoodLoginDraft(broken,draft));assert.equal(readFoodLoginDraft(broken,draft.ownerId),null)
 const store=storage();saveFoodLoginDraft(store,draft);store.map.set([...store.map.keys()][0],'{broken');assert.equal(readFoodLoginDraft(store,draft.ownerId),null)
 saveFoodLoginDraft(store,draft);clearFoodLoginDraft(store);assert.equal(store.map.size,0)
 assert.equal(loginDraftCooldown(100000,200000),0)
})
