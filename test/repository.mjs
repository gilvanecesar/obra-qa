import {test} from 'node:test';
import assert from 'node:assert/strict';
import {repositoryURL} from '../src/repository.mjs';
test('repository onboarding accepts GitHub repo URLs but rejects credential, local and branch URLs',()=>{
 assert.equal(repositoryURL('https://github.com/gilvanecesar/obra-cockpit'),'https://github.com/gilvanecesar/obra-cockpit.git');
 for(const u of ['http://github.com/a/b','https://user:secret@github.com/a/b','https://localhost/a/b','file:///tmp/repo','https://github.com/a/b/tree/main','https://github.com/a/b?token=x'])assert.throws(()=>repositoryURL(u));
});
