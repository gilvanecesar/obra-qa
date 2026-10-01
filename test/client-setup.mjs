import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBridge} from '../src/bridge.mjs';

const exec=promisify(execFile);
// Isolate the paired-connection file so the test never reads a real pairing.
const isolated=dir=>({OBRA_QA_CONNECTION_FILE:join(dir,'connection.json')});

test('with no executor configured, the client onboards toward chat pairing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'obra-client-'));
 try{
  const empty=join(dir,'empty');writeFileSync(empty,'   \n');
  for(const file of ['',join(dir,'missing'),empty]){
   await assert.rejects(exec(process.execPath,['scripts/qa-client.mjs','projects'],{
    env:{...process.env,...isolated(dir),OBRA_QA_URL:'',OBRA_QA_TOKEN_FILE:file,OBRA_QA_CA_FILE:''},
   }),error=>{
    assert.equal(error.code,1);
    assert.match(error.stderr,/not connected to an executor/i);
    assert.match(error.stderr,/executor-up\.mjs/);
    assert.match(error.stderr,/OBRAQA1-|pairing code/i);
    assert.doesNotMatch(error.stderr,/TypeError|at readFileSync/);
    assert.equal(error.stdout,'');
    return true;
   });
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('configured client authenticates to its executor without printing the token',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'obra-client-')),token='test-secret-'.repeat(4);
 const file=join(dir,'token');writeFileSync(file,token);
 const server=createBridge({token,projects:{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {stdout,stderr}=await exec(process.execPath,['scripts/qa-client.mjs','projects'],{
   env:{...process.env,...isolated(dir),OBRA_QA_URL:`http://127.0.0.1:${server.address().port}`,OBRA_QA_TOKEN_FILE:file,OBRA_QA_CA_FILE:''},
  });
  assert.deepEqual(JSON.parse(stdout),{projects:[]});
  assert.equal(stderr,'');assert.ok(!stdout.includes(token));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});

test('a pairing code connects the client with no environment variables',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'obra-client-')),token='pair-secret-'.repeat(4);
 const server=createBridge({token,projects:{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 const code='OBRAQA1-'+Buffer.from(JSON.stringify({u:url,t:token})).toString('base64url');
 const env={...process.env,...isolated(dir),OBRA_QA_URL:'',OBRA_QA_TOKEN_FILE:'',OBRA_QA_CA_FILE:''};
 try{
  const paired=await exec(process.execPath,['scripts/qa-client.mjs','pair',code],{env});
  assert.match(paired.stdout,/Paired/);
  assert.ok(existsSync(env.OBRA_QA_CONNECTION_FILE));
  assert.ok(!paired.stdout.includes(token));            // never echoes the credential
  assert.equal(JSON.parse(readFileSync(env.OBRA_QA_CONNECTION_FILE,'utf8')).token,token);
  // Now the client works with no env vars, reading the stored pairing.
  const {stdout}=await exec(process.execPath,['scripts/qa-client.mjs','projects'],{env});
  assert.deepEqual(JSON.parse(stdout),{projects:[]});
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});

test('a malformed pairing code is rejected and writes nothing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'obra-client-'));
 const env={...process.env,...isolated(dir),OBRA_QA_URL:'',OBRA_QA_TOKEN_FILE:'',OBRA_QA_CA_FILE:''};
 try{
  await assert.rejects(exec(process.execPath,['scripts/qa-client.mjs','pair','not-a-code'],{env}),error=>{
   assert.equal(error.code,1);
   assert.match(error.stderr,/not an Obra QA pairing code/i);
   return true;
  });
  assert.ok(!existsSync(env.OBRA_QA_CONNECTION_FILE));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
