import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';import {resolve,join} from 'node:path';import {randomBytes} from 'node:crypto';import {execFileSync as exec} from 'node:child_process';
const local=resolve('local'),repo=join(local,'fixture');mkdirSync(repo,{recursive:true});
const git=(...a)=>exec('git',['-C',repo,...a],{encoding:'utf8'}).trim();
if(!existsSync(join(repo,'.git'))){
 git('init');git('config','user.name','Obra QA fixture');git('config','user.email','fixture@example.invalid');
 writeFileSync(join(repo,'access.mjs'),'export const canRead=(u,r)=>u.id===r.ownerId;\n');
 writeFileSync(join(repo,'test.mjs'),`import {test} from 'node:test';import assert from 'node:assert/strict';import {canRead} from './access.mjs';test('tenant isolation',()=>assert.equal(canRead({id:1,tenant:'A'},{ownerId:1,tenant:'B'}),false));`);
 git('add','.');git('commit','-m','Synthetic cross-tenant bug');
 const broken=git('rev-parse','HEAD');
 writeFileSync(join(repo,'access.mjs'),'export const canRead=(u,r)=>u.tenant===r.tenant&&u.id===r.ownerId;\n');
 git('add','.');git('commit','-m','Fix tenant isolation');
 writeFileSync(join(local,'revisions.json'),JSON.stringify({broken,fixed:git('rev-parse','HEAD')},null,2));
}
const secret=join(local,'bridge-token');if(!existsSync(secret))writeFileSync(secret,randomBytes(32).toString('hex'),{mode:0o600});
const image=exec('docker',['image','inspect','obra-qa-runner','--format','{{.Id}}'],{encoding:'utf8'}).trim();
const config={port:4781,tls:{key:join(local,'bridge.key'),cert:join(local,'bridge.crt')},out:resolve('runs'),projects:{demo:{repo,spec:{image,checks:[{name:'tenant-isolation',argv:['node','--test','test.mjs'],timeoutMs:30000}]}}}};
writeFileSync(join(local,'bridge.json'),JSON.stringify(config,null,2));console.log('Local fixture and private configuration ready.');

writeFileSync(resolve('openclaw/demo-revisions.json'),readFileSync(join(local,'revisions.json')));
