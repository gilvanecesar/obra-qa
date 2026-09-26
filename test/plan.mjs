import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,applyPlan,coverageFor} from '../src/plan.mjs';
const revision='a'.repeat(40);
const plan=()=>({revision,requirements:[{id:'r',behavior:'Reject invalid inputs',basis:'Documented contract'},{id:'external',behavior:'External service works',basis:'README'}],tests:[{name:'validation',requirements:['r'],source:"import assert from 'node:assert/strict'; assert.equal(1,1);"}]});
test('plans pin revisions, restrict paths and preserve unmapped requirements',()=>{
 assert.throws(()=>validatePlan(plan(),'b'.repeat(40)));
 for(const name of ['../escape','nested/file','']){const p=plan();p.tests[0].name=name;assert.throws(()=>validatePlan(p,revision));}
 const p=plan();p.tests[0].requirements=['unknown'];assert.throws(()=>validatePlan(p,revision));
 assert.deepEqual(coverageFor(plan(),[{name:'generated-validation',status:'passed'}]).map(r=>r.status),['checks-passed','not-tested']);
 assert.equal(coverageFor(plan(),[{name:'generated-validation',status:'execution-error'}])[0].status,'needs-review');
});
test('generated execution is fixed to isolated node test with bounded check count',()=>{
 const spec=applyPlan({image:'sha256:'+'b'.repeat(64),checks:[]},plan());
 assert.equal(spec.checks[0].argv.at(-1),'.obra-qa-tests/validation.test.mjs');
 assert.throws(()=>applyPlan({checks:Array(10).fill({})},plan()));
});
