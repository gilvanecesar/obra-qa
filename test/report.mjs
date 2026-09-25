import {test} from 'node:test';import assert from 'node:assert/strict';
import {verdict,validate} from '../src/audit.mjs';
test('blocked, empty and partial runs never pass',()=>{for(const c of [[],[{status:'timeout'}],[{status:'passed'},{status:'execution-error'}]])assert.equal(verdict(c),'INCONCLUSIVE');});
test('only successful checks pass',()=>assert.equal(verdict([{status:'passed'}]),'PASSED'));
test('mutable images rejected',()=>assert.throws(()=>validate({image:'node:latest',checks:[]})));
test('duplicate check names rejected',()=>assert.throws(()=>validate({image:'sha256:'+'a'.repeat(64),checks:[1,2].map(()=>({name:'a',argv:['node'],timeoutMs:1000}))})));
