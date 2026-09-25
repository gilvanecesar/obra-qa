import {prepareRepository,repositoryURL} from './repository.mjs';
import {createServer} from 'node:http';
import {createServer as createTlsServer} from 'node:https';
import {timingSafeEqual, randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolveRevision,inspectProject} from './project.mjs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {audit,validate} from './audit.mjs';
import {resolve,join} from 'node:path';

// One trusted team per installation. Public multi-tenant hosting is intentionally unsupported.
export function createBridge({token,projects,out='runs',runner=audit,prepare=prepareRepository,tls,pdfPython=process.env.OBRA_QA_PDF_PYTHON}){
 if(typeof token!=='string'||token.length<32)throw Error('Bridge token must be at least 32 characters');
 for(const [id,p] of Object.entries(projects)){
  if(!/^[a-z0-9-]+$/.test(id))throw Error('Invalid project id');
  validate(p.spec);
 }
 const jobs=new Map();let busy=false;
 const send=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 const handler=async(req,res)=>{
  const expected=Buffer.from(`Bearer ${token}`),provided=Buffer.from(req.headers.authorization||'');
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return send(res,401,{error:'Unauthorized'});
  // Browser cross-origin clients are not part of the protocol.
  if(req.headers.origin)return send(res,403,{error:'Browser origins are not supported'});
  if(req.method==='GET'&&req.url==='/projects')return send(res,200,{projects:Object.keys(projects)});
  if(req.method==='GET'&&/^\/jobs\/[a-f0-9-]{36}\/report\.pdf$/.test(req.url)){
   const job=jobs.get(req.url.split('/')[2]);if(job?.pdf?.state!=='ready')return send(res,404,{error:'PDF not available'});
   res.writeHead(200,{'content-type':'application/pdf','cache-control':'no-store'});return res.end(readFileSync(join(job.dir,'report.pdf')));
  }
  if(req.method==='GET'&&/^\/jobs\/[a-f0-9-]{36}$/.test(req.url)){
   const job=jobs.get(req.url.split('/')[2]);return send(res,job?200:404,job?{...job,dir:undefined}:{error:'Unknown job'});
  }
  if(req.method!=='POST'||req.url!=='/jobs')return send(res,404,{error:'Unknown route'});
  let body='';
  try{
   for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){send(res,413,{error:'Body too large'});return;}}
   const value=JSON.parse(body);
   if(!value||Object.keys(value).some(k=>!['project','revision','repository'].includes(k))||(value.repository ? (value.project!==undefined || typeof value.repository!=='string') : !Object.hasOwn(projects,value.project))||(value.revision!==undefined&&!/^[a-f0-9]{40,64}$/.test(value.revision)))return send(res,400,{error:'Use a GitHub repository URL or configured project, with an optional full commit SHA'});
   if(busy)return send(res,409,{error:'An audit is already running'});
   if(jobs.size>=100){const first=[...jobs].find(([,j])=>j.state!=='running');if(first)jobs.delete(first[0]);}
   if(value.repository)repositoryURL(value.repository);
   const projectConfig=projects[value.project];
   if(!value.repository&&value.revision===undefined)value.revision=resolveRevision(projectConfig.repo);
   const id=randomUUID();jobs.set(id,{id,state:'running',project:value.project||value.repository,revision:value.revision,events:[]});busy=true;
   send(res,202,jobs.get(id));
   let p=projects[value.project],prepared;
   const event=e=>{const j=jobs.get(id);j.events.push({...e,at:new Date().toISOString(),sequence:j.events.length+1});};
   Promise.resolve().then(async()=>{
    if(value.repository){prepared=await prepare(value.repository,value.revision,event);p=prepared;value.revision=p.revision;jobs.get(id).revision=p.revision;jobs.get(id).coverageGaps=p.gaps;}
    if(runner===audit){jobs.get(id).analysis=inspectProject(p.repo,value.revision);event({stage:'documentation',state:'completed'});}
    return runner(p.repo,p.spec,value.revision,out,event);
   }).then(result=>{
    if(prepared?.gaps.length){result.report.limits.push(...prepared.gaps);result.report.verdict='INCONCLUSIVE';}
    const evidence = result.dir ? result.report.checks.map(c=>({check:c.name,untrusted:true,text:readFileSync(join(result.dir,c.evidence),'utf8').slice(0,12000)})) : [];
    let pdf={state:'unavailable'};
    if(result.dir){
     result.report.analysis=jobs.get(id).analysis;
     writeFileSync(join(result.dir,'report.json'),JSON.stringify(result.report,null,2));
     if(prepared?.gaps.length)writeFileSync(join(result.dir,'report.md'),`# Obra QA: INCONCLUSIVE\n\nRevision: ${result.report.revision}\n\n`+result.report.checks.map(c=>`- ${c.name}: ${c.status}; evidence ${c.evidence}`).join('\n')+'\n\n'+result.report.limits.join('\n'));
     if(pdfPython){event({stage:'pdf',state:'running'});try{
      execFileSync(pdfPython,[fileURLToPath(new URL('../scripts/report-pdf.py',import.meta.url)),join(result.dir,'report.json'),join(result.dir,'report.pdf')],{timeout:30000,stdio:'pipe'});
      pdf={state:'ready',path:`/jobs/${id}/report.pdf`};event({stage:'pdf',state:'completed'});
     }catch{pdf={state:'error'};event({stage:'pdf',state:'error'});}}
     writeFileSync(join(result.dir,'events.json'),JSON.stringify(jobs.get(id).events,null,2));
    }
    jobs.set(id,{...jobs.get(id),state:'completed',report:result.report,evidence,pdf,dir:result.dir});
   }).catch(e=>{console.error('Audit failed:',e.message);jobs.set(id,{...jobs.get(id),state:'error',error:prepared||!value.repository?'Audit execution failed; see operator logs.':e.message});}).finally(()=>{prepared?.cleanup();busy=false;});
  }catch{if(!res.headersSent)send(res,400,{error:'Invalid request'});}
 };
 return tls ? createTlsServer(tls,handler) : createServer(handler);
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
 const token=readFileSync(process.env.OBRA_QA_TOKEN_FILE,'utf8').trim();
 const server=createBridge({token,projects:config.projects,out:resolve(config.out||'runs'),tls:config.tls?{key:readFileSync(config.tls.key),cert:readFileSync(config.tls.cert)}:undefined});
 server.listen(config.port||4781,'127.0.0.1',()=>console.log('Obra QA bridge listening on loopback'));
}
