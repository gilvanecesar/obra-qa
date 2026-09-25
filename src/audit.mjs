import {spawn,execFileSync as exec} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export function verdict(checks){
 if(!checks.length || checks.some(c=>c.status!=='passed'))return 'INCONCLUSIVE';
 return 'PASSED';
}
export function validate(spec){
 if(!/^sha256:[a-f0-9]{64}$/.test(spec?.image||''))throw Error('Immutable local image ID required');
 if(!Array.isArray(spec.checks)||!spec.checks.length||spec.checks.length>10)throw Error('1–10 checks required');
 const names=new Set();
 for(const c of spec.checks){
  if(!/^[\w-]{1,60}$/.test(c.name||'')||names.has(c.name))throw Error('Invalid or duplicate name');
  names.add(c.name);
  if(!Array.isArray(c.argv)||!c.argv.length||c.argv.some(v=>typeof v!=='string'||!v||v.includes('\0')))throw Error('Invalid argv');
  if(!Number.isInteger(c.timeoutMs)||c.timeoutMs<100||c.timeoutMs>120000)throw Error('Invalid timeout');
 }
}
function execute(args,timeout){return new Promise(done=>{
 const start=Date.now();let output='',status='execution-error';
 const p=spawn('docker',args,{stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>{status='timeout';p.kill('SIGKILL');},timeout);
 const collect=b=>{if(output.length+b.length>1048576){status='output-limit';p.kill('SIGKILL');}else output+=b.toString();};
 p.stdout.on('data',collect);p.stderr.on('data',collect);
 p.on('error',e=>{output+=e.message;});
 p.on('close',code=>{clearTimeout(timer);done({status:code===0 && status==='execution-error'?'passed':status,exitCode:code,durationMs:Date.now()-start,output});});
});}
export async function audit(repo,spec,revision='HEAD',out='runs',onProgress=()=>{}){
 validate(spec);repo=resolve(repo);
 const sha=exec('git',['-C',repo,'rev-parse','--verify',`${revision}^{commit}`],{encoding:'utf8'}).trim();
 if(!/^[a-f0-9]{40,64}$/.test(sha))throw Error('Invalid revision');
 exec('docker',['image','inspect',spec.image],{stdio:'pipe'});
 const id=randomUUID(),dir=resolve(out,id),tmp=mkdtempSync(join(tmpdir(),'obra-qa-'));
 mkdirSync(dir,{recursive:true});
 try{
 onProgress({stage:'preparation',state:'completed',revision:sha});
 const archive=join(tmp,'source.tar');exec('git',['-C',repo,'archive','--format=tar','-o',archive,sha]);
 const checks=[];
 for(const c of spec.checks){
  onProgress({stage:'check',state:'running',check:c.name});
  const name=`obra-qa-${id}-${checks.length}`;
  const args=['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=512m','--cpus=1','--user=1000:1000','--tmpfs','/work:rw,nosuid,nodev,size=128m,mode=1777','--tmpfs','/tmp:rw,nosuid,nodev,size=64m,mode=1777','--mount',`type=bind,src=${archive},dst=/source.tar,readonly`,'--workdir=/work','--entrypoint=/bin/sh',spec.image,'-c','tar -xf /source.tar -C /work && exec "$@"','qa',...c.argv];
  const r=await execute(args,c.timeoutMs);
  try{exec('docker',['rm','-f',name],{stdio:'ignore',timeout:5000});}catch{}
  const evidence=`${c.name}.log`;writeFileSync(join(dir,evidence),r.output);
  const {output,...meta}=r;onProgress({stage:'check',state:'completed',check:c.name,status:meta.status,exitCode:meta.exitCode});checks.push({...meta,name:c.name,argv:c.argv,evidence,sha256:createHash('sha256').update(output).digest('hex')});
 }
 const report={schemaVersion:1,id,revision:sha,image:spec.image,verdict:verdict(checks),checks,limits:['Only listed commands are covered.','Nonzero exits require evidence review; they are not automatically confirmed bugs.','No network, host credentials or untracked dependencies inherited.']};
 writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2));
 writeFileSync(join(dir,'report.md'),`# Obra QA: ${report.verdict}\n\nRevision: ${sha}\n\n`+checks.map(c=>`- ${c.name}: ${c.status}; exit ${c.exitCode}; ${c.durationMs}ms; evidence ${c.evidence}`).join('\n')+'\n\n'+report.limits.join('\n'));
 return {dir,report};
 }finally{rmSync(tmp,{recursive:true,force:true});}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const [repo,file,rev]=process.argv.slice(2);
 try{console.log(JSON.stringify(await audit(repo,JSON.parse(readFileSync(file,'utf8')),rev),null,2));}catch(e){console.error(e.message);process.exitCode=2;}
}
