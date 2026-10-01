import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
const [action,project,revision,planFile]=process.argv.slice(2);
// Where a chat-paired connection is stored, so a phone-only owner never has to
// set environment variables or hand the agent a token file on the host.
const connectionFile=process.env.OBRA_QA_CONNECTION_FILE||join(homedir(),'.obra-qa','connection.json');
const loopbackOK=u=>u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname));

// `pair CODE` establishes the connection from the code executor-up.mjs printed.
// The owner texts that code; the agent runs this. Runs before the token check.
if(action==='pair'){
 const m=/^OBRAQA1-([A-Za-z0-9_-]+)$/.exec((project||'').trim());
 if(!m){console.error('That is not an Obra QA pairing code. On the machine running the executor, run `node scripts/executor-up.mjs` and send me the OBRAQA1-… code it prints.');process.exit(1);}
 let conn;
 try{conn=JSON.parse(Buffer.from(m[1],'base64url').toString('utf8'));}
 catch{console.error('That pairing code is corrupted — generate a fresh one with executor-up.mjs.');process.exit(1);}
 if(typeof conn?.u!=='string'||typeof conn?.t!=='string'||conn.t.length<32){console.error('That pairing code is missing a valid executor URL or token.');process.exit(1);}
 let u;try{u=new URL(conn.u);}catch{console.error('That pairing code has an invalid executor URL.');process.exit(1);}
 if(!loopbackOK(u)){console.error('Pairing refused: a non-loopback executor must use HTTPS.');process.exit(1);}
 mkdirSync(dirname(connectionFile),{recursive:true});
 writeFileSync(connectionFile,JSON.stringify({url:conn.u,token:conn.t,...(conn.c?{ca:conn.c}:{})}),{mode:0o600});
 console.log(`Paired with the executor at ${u.origin}. Ask me for a QA check whenever you like.`);
 process.exit(0);
}

// Resolve the connection: explicit environment wins; otherwise a stored pairing.
let baseUrl=process.env.OBRA_QA_URL||'',token='',caPem='';
try{token=process.env.OBRA_QA_TOKEN_FILE?readFileSync(process.env.OBRA_QA_TOKEN_FILE,'utf8').trim():'';}
catch(error){if(!['ENOENT','EACCES','EISDIR'].includes(error.code))throw error;}
try{caPem=process.env.OBRA_QA_CA_FILE?readFileSync(process.env.OBRA_QA_CA_FILE,'utf8'):'';}
catch(error){if(!['ENOENT','EACCES','EISDIR'].includes(error.code))throw error;}
if(!baseUrl||!token){
 try{const s=JSON.parse(readFileSync(connectionFile,'utf8'));baseUrl=baseUrl||s.url||'';token=token||(s.token||'').trim();if(!caPem&&s.ca)caPem=s.ca;}
 catch(error){if(!['ENOENT','EACCES','EISDIR'].includes(error.code))throw error;}
}
if(!baseUrl)baseUrl='http://127.0.0.1:4781';
const base=new URL(baseUrl);
if(!loopbackOK(base))throw Error('Remote bridge requires HTTPS');
if(!token){
 console.error([
  'Obra QA is not connected to an executor yet, so there is nothing to run against.',
  'Obra QA never runs your code itself — it delegates to an isolated executor (a small',
  'service with Docker that you run and trust). To connect, entirely from this chat:',
  '',
  '  1. On any machine with Docker, from the obra-qa repo, run:  node scripts/executor-up.mjs',
  '  2. It prints a one-line pairing code (OBRAQA1-…). Send me that code here.',
  '',
  'I will connect myself — you never set environment variables or paste a raw token.',
  'Full guide: docs/SETUP.md.'].join('\n'));
 process.exit(1);
}
let path,method='GET',body;
if(action==='projects')path='/projects';
else if(action==='start'||action==='inspect'){
 path=action==='inspect'?'/inspect':'/jobs';method='POST';
 const plan=planFile?JSON.parse(readFileSync(planFile,'utf8')):undefined;
 body=JSON.stringify(project?.startsWith('https://')?{repository:project,revision,plan}:{project,revision,plan});
}
else if(action==='pdf'&&/^[a-f0-9-]{36}$/.test(project||''))path=`/jobs/${project}/report.pdf`;
else if(action==='status'&&/^[a-f0-9-]{36}$/.test(project||''))path=`/jobs/${project}`;
else throw Error('Usage: qa-client.mjs pair OBRAQA1-… | projects | start PROJECT_OR_GITHUB_URL [COMMIT_SHA] | status JOB_ID');
const target=new URL(path,base);
const request=target.protocol==='https:'?httpsRequest:httpRequest;
const options={method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(caPem?{ca:Buffer.from(caPem)}:{})};
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
 req.setTimeout(action==='inspect'?200000:10000,()=>req.destroy(Error('Bridge timeout')));req.on('error',reject);
 if(body)req.write(body);req.end();
});
