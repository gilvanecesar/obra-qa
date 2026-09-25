import {readFileSync,writeFileSync} from 'node:fs';
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
const [action,project,revision]=process.argv.slice(2);
const base=new URL(process.env.OBRA_QA_URL||'http://127.0.0.1:4781');
if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw Error('Remote bridge requires HTTPS');
const token=readFileSync(process.env.OBRA_QA_TOKEN_FILE,'utf8').trim();
let path,method='GET',body;
if(action==='projects')path='/projects';
else if(action==='start'){path='/jobs';method='POST';body=JSON.stringify({project,revision});}
else if(action==='pdf'&&/^[a-f0-9-]{36}$/.test(project||''))path=`/jobs/${project}/report.pdf`;
else if(action==='status'&&/^[a-f0-9-]{36}$/.test(project||''))path=`/jobs/${project}`;
else throw Error('Usage: qa-client.mjs projects | start PROJECT COMMIT_SHA | status JOB_ID');
const target=new URL(path,base);
const request=target.protocol==='https:'?httpsRequest:httpRequest;
const options={method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(process.env.OBRA_QA_CA_FILE?{ca:readFileSync(process.env.OBRA_QA_CA_FILE)}:{})};
await new Promise((resolve,reject)=>{
 const req=request(target,options,res=>{
  if(action==='pdf'){
   if(res.statusCode!==200){res.resume();reject(Error('PDF not ready'));return;}
   const chunks=[];let bytes=0;res.on('data',c=>{bytes+=c.length;if(bytes>10*1024*1024)res.destroy(Error('PDF too large'));else chunks.push(c);});
   res.on('error',reject);res.on('end',()=>{const file=`/tmp/obra-qa-${project}.pdf`;writeFileSync(file,Buffer.concat(chunks));console.log(JSON.stringify({file}));resolve();});return;
  }
  let output='';res.setEncoding('utf8');
  res.on('data',chunk=>{output+=chunk;if(output.length>2000000)res.destroy(Error('Response too large'));});
  res.on('error',reject);
  res.on('end',()=>{console.log(output);if(res.statusCode<200||res.statusCode>=300)process.exitCode=1;resolve();});
 });
 req.setTimeout(10000,()=>req.destroy(Error('Bridge timeout')));req.on('error',reject);
 if(body)req.write(body);req.end();
});
