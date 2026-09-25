import {execFileSync} from 'node:child_process';
const git=(repo,...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',maxBuffer:2*1024*1024,timeout:10000}).trim();
export function resolveRevision(repo){return git(repo,'rev-parse','--verify','HEAD^{commit}');}
// Read only committed documentation, never working-tree secrets or repository commands.
export function inspectProject(repo,sha){
 const files=git(repo,'ls-tree','-r','--name-only',sha).split('\n');
 const docs=files.filter(f=>/^(README|readme)(\.md|\.txt)?$/.test(f));
 const documentation=docs.map(path=>({path,text:git(repo,'show',`${sha}:${path}`).slice(0,16000),untrusted:true}));
 return {revision:sha,trackedFiles:files.length,documentation,analysisType:'documentation-inventory',coverage:'Documentation is not execution evidence. Only configured checks will run.'};
}
