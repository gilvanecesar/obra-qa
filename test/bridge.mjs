import {test} from 'node:test';import assert from 'node:assert/strict';
import {createBridge} from '../src/bridge.mjs';
const token='a'.repeat(48),sha='b'.repeat(40),spec={image:'sha256:'+'c'.repeat(64),checks:[{name:'unit',argv:['node','--test'],timeoutMs:1000}]};
test('bridge authenticates, rejects arbitrary execution and serializes jobs',async()=>{
 let finish;const runner=()=>new Promise(r=>{finish=r});
 const s=createBridge({token,projects:{demo:{repo:'/irrelevant',spec}},runner});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${s.address().port}`;
 const call=(path,body,auth=token)=>fetch(url+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${auth}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
 assert.equal((await call('/projects',null,'wrong')).status,401);
 assert.deepEqual(await (await call('/projects')).json(),{projects:['demo']});
 for(const b of [{project:'../private',revision:sha},{project:'demo',revision:'HEAD'},{project:'demo',revision:sha,argv:['sh']}])assert.equal((await call('/jobs',b)).status,400);
 const r=await call('/jobs',{project:'demo',revision:sha});assert.equal(r.status,202);const job=await r.json();
 assert.equal((await call('/jobs',{project:'demo',revision:sha})).status,409);
 finish({report:{verdict:'PASSED'}});
 await new Promise(r=>setImmediate(r));
 assert.equal((await (await call(`/jobs/${job.id}`)).json()).state,'completed');
 }finally{s.closeAllConnections();await new Promise(r=>s.close(r));}
});
test('repository URL onboarding pins revision, reports coverage gaps and cleans up',async()=>{
 let cleaned=false;
 const s=createBridge({token,projects:{},prepare:async(url,rev,event)=>{
  assert.equal(url,'https://github.com/example/demo');assert.equal(rev,undefined);
  event({stage:'repository',state:'completed'});
  return {repo:'/fixture',revision:sha,spec,gaps:['No functional tests'],cleanup:()=>{cleaned=true}};
 },runner:async()=>({report:{verdict:'PASSED',checks:[],limits:[]}})});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${s.address().port}`;
 try{
 const response=await fetch(url+'/jobs',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({repository:'https://github.com/example/demo'})});
 assert.equal(response.status,202);const {id}=await response.json();
 await new Promise(r=>setImmediate(r));
 const result=await (await fetch(url+'/jobs/'+id,{headers:{authorization:`Bearer ${token}`}})).json();
 assert.equal(result.state,'completed');assert.equal(result.revision,sha);assert.equal(result.report.verdict,'INCONCLUSIVE');assert.deepEqual(result.coverageGaps,['No functional tests']);assert.ok(cleaned);
 }finally{s.closeAllConnections();await new Promise(r=>s.close(r));}
});
