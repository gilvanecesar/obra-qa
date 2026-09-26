import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBridge} from '../src/bridge.mjs';

const exec=promisify(execFile);
test('client explains missing, unreadable and empty executor token configuration',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'obra-client-'));
 try{
  const empty=join(dir,'empty');writeFileSync(empty,'   \n');
  for(const file of ['',join(dir,'missing'),empty]){
   await assert.rejects(exec(process.execPath,['scripts/qa-client.mjs','projects'],{
    env:{...process.env,OBRA_QA_URL:'http://127.0.0.1:4781',OBRA_QA_TOKEN_FILE:file,OBRA_QA_CA_FILE:''},
   }),error=>{
    assert.equal(error.code,1);
    assert.match(error.stderr,/setup incomplete/i);
    assert.match(error.stderr,/OBRA_QA_TOKEN_FILE/);
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
   env:{...process.env,OBRA_QA_URL:`http://127.0.0.1:${server.address().port}`,OBRA_QA_TOKEN_FILE:file,OBRA_QA_CA_FILE:''},
  });
  assert.deepEqual(JSON.parse(stdout),{projects:[]});
  assert.equal(stderr,'');assert.ok(!stdout.includes(token));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
