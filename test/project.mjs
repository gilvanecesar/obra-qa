import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspectProject,resolveRevision} from '../src/project.mjs';
import {createBridge} from '../src/bridge.mjs';
test('omitted revision pins HEAD and inventory ignores uncommitted documentation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'qa-project-'));let server;
 const git=(...a)=>execFileSync('git',['-C',dir,...a],{stdio:'pipe'});
 try{
 git('init');git('config','user.name','QA');git('config','user.email','qa@example.invalid');
 writeFileSync(join(dir,'README.md'),'Committed feature');git('add','.');git('commit','-m','fixture');
 const sha=resolveRevision(dir);writeFileSync(join(dir,'README.md'),'PRIVATE UNCOMMITTED CONTENT');
 assert.equal(inspectProject(dir,sha).documentation[0].text,'Committed feature');
 let received;
 server=createBridge({token:'a'.repeat(32),projects:{sample:{repo:dir,spec:{image:'sha256:'+'b'.repeat(64),checks:[{name:'check',argv:['true'],timeoutMs:1000}]}}},runner:async(repo,spec,rev,out,progress)=>{received=rev;progress({stage:'check',state:'completed'});return {report:{checks:[]}};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,headers={authorization:'Bearer '+'a'.repeat(32),'content-type':'application/json'};
 const response=await fetch(base+'/jobs',{method:'POST',headers,body:JSON.stringify({project:'sample'})});
 assert.equal(response.status,202);const job=await response.json();assert.equal(job.revision,sha);
 const status=await(await fetch(base+'/jobs/'+job.id,{headers})).json();
 assert.equal(received,sha);assert.equal(status.events[0].stage,'check');assert.equal(status.pdf.state,'unavailable');
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}rmSync(dir,{recursive:true,force:true});}
});

test('source inspection reads only bounded committed source, not untracked files or symlinks',async()=>{
 const {inspectSource}=await import('../src/project.mjs');
 const {symlinkSync}=await import('node:fs');
 const dir=mkdtempSync(join(tmpdir(),'qa-inspect-'));
 const git=(...a)=>execFileSync('git',['-C',dir,...a],{stdio:'pipe'});
 try{
 git('init');git('config','user.name','QA');git('config','user.email','qa@example.invalid');
 writeFileSync(join(dir,'README.md'),'Feature contract');writeFileSync(join(dir,'app.mjs'),'export const ready=true;');
 writeFileSync(join(dir,'token.mjs'),'DO NOT INCLUDE');symlinkSync('/etc/passwd',join(dir,'link.js'));
 git('add','.');git('commit','-m','fixture');writeFileSync(join(dir,'untracked.js'),'PRIVATE');
 const inspected=inspectSource(dir,resolveRevision(dir));
 assert.deepEqual(inspected.sources.map(s=>s.path),['app.mjs']);assert.equal(inspected.sources[0].untrusted,true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
