import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync as exec} from 'node:child_process';import assert from 'node:assert/strict';import {audit} from '../src/audit.mjs';
const repo=mkdtempSync(join(tmpdir(),'qa-fixture-'));
const git=(...args)=>exec('git',['-C',repo,...args],{encoding:'utf8'}).trim();
try{
 git('init');git('config','user.name','Obra QA Demo');git('config','user.email','demo@example.invalid');
 writeFileSync(join(repo,'access.mjs'),'export const canRead=(u,r)=>u.id===r.ownerId;\n');
 writeFileSync(join(repo,'test.mjs'),`import {test} from 'node:test';import assert from 'node:assert/strict';import {canRead} from './access.mjs';test('deny cross-tenant access',()=>assert.equal(canRead({id:1,tenant:'A'},{ownerId:1,tenant:'B'}),false));test('allow owner in same tenant',()=>assert.equal(canRead({id:1,tenant:'A'},{ownerId:1,tenant:'A'}),true));`);
 git('add','.');git('commit','-m','Synthetic tenant regression');
 const image=exec('docker',['image','inspect','obra-qa-runner','--format','{{.Id}}'],{encoding:'utf8'}).trim();
 const spec={image,checks:[{name:'tenant',argv:['node','--test','test.mjs'],timeoutMs:30000}]};
 const broken=await audit(repo,spec);
 assert.equal(broken.report.checks[0].exitCode,1);
 writeFileSync(join(repo,'access.mjs'),'export const canRead=(u,r)=>u.tenant===r.tenant&&u.id===r.ownerId;\n');
 git('add','.');git('commit','-m','Fix tenant guard');
 const fixed=await audit(repo,spec);assert.equal(fixed.report.verdict,'PASSED');
 const isolation=await audit(repo,{image,checks:[{name:'isolation',argv:['node','-e',`const fs=require('fs');if(process.env.PLOW_AGENT_TOKEN||fs.existsSync('/var/run/docker.sock'))process.exit(1);try{fs.writeFileSync('/leak','x');process.exit(1)}catch{};console.log('No inherited token/socket; root filesystem is read-only')`],timeoutMs:30000},{name:'timeout',argv:['node','-e','setInterval(()=>{},1000)'],timeoutMs:1500}]});
 assert.equal(isolation.report.checks[0].status,'passed');assert.equal(isolation.report.checks[1].status,'timeout');assert.equal(isolation.report.verdict,'INCONCLUSIVE');
 console.log(JSON.stringify({broken:broken.dir,fixed:fixed.dir,isolation:isolation.dir},null,2));
}finally{rmSync(repo,{recursive:true,force:true});}
