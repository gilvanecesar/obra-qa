import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createBridge} from '../src/bridge.mjs';
test('inspect then submit mapped generated tests on the pinned revision',async()=>{
 const repo=mkdtempSync(join(tmpdir(),'qa-deep-'));let server,received,cleaned=0;
 const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
 git('init');git('config','user.name','QA');git('config','user.email','qa@example.invalid');
 writeFileSync(join(repo,'README.md'),'add returns sum');writeFileSync(join(repo,'app.mjs'),'export const add=(a,b)=>a+b;');git('add','.');git('commit','-m','fixture');const revision=git('rev-parse','HEAD');
 const spec={image:'sha256:'+'b'.repeat(64),checks:[{name:'syntax',argv:['node','--check','app.mjs'],timeoutMs:1000}]};
 server=createBridge({token:'x'.repeat(32),projects:{},prepare:async()=>({repo,revision,spec,gaps:['No npm test script: functionality has not been verified.'],cleanup:()=>{cleaned++}}),runner:async(repo,spec)=>{received=spec;return {report:{checks:spec.checks.map(c=>({...c,status:'passed'})),limits:[],verdict:'PASSED'}};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,headers={authorization:'Bearer '+'x'.repeat(32)};
 const post=(route,value)=>fetch(base+route,{method:'POST',headers,body:JSON.stringify(value)});
 const inspection=await(await post('/inspect',{repository:'https://github.com/example/test'})).json();assert.equal(inspection.revision,revision);assert.equal(inspection.sources[0].path,'app.mjs');assert.equal(cleaned,1);
 const plan={revision,requirements:[{id:'sum',behavior:'Returns sum',basis:'README.md'}],tests:[{name:'sum',requirements:['sum'],source:"import {test} from 'node:test'; test('sum',()=>{});"}]};
 assert.equal((await post('/jobs',{repository:'https://github.com/example/test',revision:'c'.repeat(40),plan})).status,400);
 const response=await post('/jobs',{repository:'https://github.com/example/test',revision,plan});assert.equal(response.status,202);const {id}=await response.json();
 await new Promise(r=>setImmediate(r));const result=await(await fetch(base+'/jobs/'+id,{headers})).json();
 assert.equal(result.state,'completed');assert.equal(received.generatedTests[0].name,'sum');assert.equal(result.report.verdict,'PASSED');assert.equal(cleaned,2);assert.ok(result.events.some(e=>e.stage==='functional-plan'));
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}rmSync(repo,{recursive:true,force:true});}
});
