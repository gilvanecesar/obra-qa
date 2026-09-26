// Synthetic acceptance fixture. This is not a customer defect or autonomous-generation proof.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {audit} from '../src/audit.mjs';
import {applyPlan} from '../src/plan.mjs';
const repo=mkdtempSync(join(tmpdir(),'qa-deep-demo-'));
const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
try {
 git('init');git('config','user.name','QA Fixture');git('config','user.email','qa@example.invalid');
 writeFileSync(join(repo,'math.mjs'),'export const add=(a,b)=>a-b;');git('add','.');git('commit','-m','synthetic defective fixture');
 const image=execFileSync('docker',['image','inspect','obra-qa-runner','--format','{{.Id}}'],{encoding:'utf8'}).trim();
 for(const fixed of [false,true]){
  if(fixed){writeFileSync(join(repo,'math.mjs'),'export const add=(a,b)=>a+b;');git('add','.');git('commit','-m','correct synthetic fixture');}
  const revision=git('rev-parse','HEAD');
  const plan={revision,requirements:[{id:'addition',behavior:'Return the sum',basis:'Synthetic fixture contract'},{id:'remote',behavior:'Remote integration',basis:'Deliberately untested acceptance case'}],tests:[{name:'addition',requirements:['addition'],source:"import {test} from 'node:test'; import assert from 'node:assert/strict'; import {add} from '../math.mjs'; test('adds positive and negative numbers',()=>{assert.equal(add(2,3),5);assert.equal(add(-2,3),1);});"}]};
  const result=await audit(repo,applyPlan({image,checks:[{name:'syntax',argv:['node','--check','math.mjs'],timeoutMs:10000}]},plan),revision,resolve('runs/deep-demo'),e=>console.log(JSON.stringify(e)));
  assert.equal(result.report.coverage[0].status,fixed?'checks-passed':'needs-review');
  assert.equal(result.report.coverage[1].status,'not-tested');
  assert.equal(result.report.verdict,'INCONCLUSIVE');
  console.log(JSON.stringify({fixed,...result}));
 }
}finally{rmSync(repo,{recursive:true,force:true});}
