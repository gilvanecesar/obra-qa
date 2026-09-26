import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const exec=promisify(execFile);
const base='node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402';
export function repositoryURL(input){
 const u=new URL(input);
 if(u.protocol!=='https:'||u.hostname!=='github.com'||u.port||u.username||u.password||u.search||u.hash||!/^\/[\w.-]+\/[\w.-]+(?:\.git)?\/?$/.test(u.pathname)||u.pathname.split('/').some(x=>x==='.'||x==='..'))throw Error('Use the HTTPS GitHub repository URL, without a branch or credentials.');
 return `https://github.com${u.pathname.replace(/\/$/,'').replace(/\.git$/,'')}.git`;
}
export async function prepareRepository(url,revision,event=()=>{},inspectionOnly=false){
 url=repositoryURL(url);
 const root=mkdtempSync(join(tmpdir(),'obra-repository-')),repo=join(root,'repo');
 const cleanup=()=>rmSync(root,{recursive:true,force:true});
 const git=async(...args)=>(await exec('git',args,{timeout:90000,maxBuffer:2*1024*1024,env:{PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'}})).stdout.trim();
 try{
 event({stage:'repository',state:'running'});
 await git('-c','http.followRedirects=false','-c','protocol.file.allow=never','clone','--depth=1','--no-checkout','--',url,repo);
 if(revision)await git('-C',repo,'-c','http.followRedirects=false','fetch','--depth=1','origin',revision);
 const sha=await git('-C',repo,'rev-parse',revision?'FETCH_HEAD':'HEAD');
 const files=(await git('-C',repo,'ls-tree','-r','--name-only',sha)).split('\n');
 event({stage:'repository',state:'completed',revision:sha});
 const show=path=>git('-C',repo,'show',`${sha}:${path}`);
 if(inspectionOnly)return {repo,revision:sha,cleanup};
 const checks=[],gaps=[];let pkg={};
 if(files.includes('package.json'))pkg=JSON.parse(await show('package.json'));
 if(files.some(f=>/\.(mjs|cjs|js)$/.test(f)))checks.push({name:'javascript-syntax',argv:['node','-e',`const fs=require('fs'),cp=require('child_process');let n=0,failed=0;function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.name==='node_modules'||e.isSymbolicLink())continue;const f=p+'/'+e.name;if(e.isDirectory())walk(f);else if(/\\.(mjs|cjs|js)$/.test(f)){n++;const r=cp.spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0){failed++;console.log(r.stderr)}}}}walk('.');console.log(n+' files checked; '+failed+' syntax failures. Syntax is not functional coverage.');process.exit(failed?1:0);`],timeoutMs:120000});
 const scripts=pkg.scripts||{};
 for(const name of ['test','lint','typecheck','build'])if(typeof scripts[name]==='string')checks.push({name,argv:['npm','run',name],timeoutMs:120000});
 if(!scripts.test)gaps.push('No npm test script: functionality has not been verified.');
 if(!checks.length)throw Error('No supported checks detected. Currently supports JavaScript syntax and npm test/lint/typecheck/build scripts. Python and other stacks need an adapter.');
 event({stage:'dependencies',state:'running'});
 const manifest=join(root,'image');await exec('mkdir',['-p',manifest]);
 const deps=Object.keys({...pkg.dependencies,...pkg.devDependencies}).length>0;
 if(deps&&!files.includes('package-lock.json'))throw Error('Dependencies detected without package-lock.json. Commit an npm lockfile for reproducible installation; other package managers are not supported yet.');
 writeFileSync(join(manifest,'package.json'),JSON.stringify({...pkg,scripts:undefined}));
 if(deps)writeFileSync(join(manifest,'package-lock.json'),await show('package-lock.json'));
 writeFileSync(join(manifest,'Dockerfile'),`FROM ${base}\nUSER root\nRUN apk add --no-cache git\nRUN mkdir /deps && chown node:node /deps\nUSER node\nWORKDIR /deps\nCOPY --chown=node:node package*.json ./\n${deps?'RUN npm ci --ignore-scripts --no-audit --no-fund\n':''}WORKDIR /work\n`);
 const imageFile=join(root,'image-id');
 try{await exec('docker',['build','--iidfile',imageFile,manifest],{timeout:240000,maxBuffer:1024*1024});}catch{throw Error('Dependency preparation failed or timed out. Requires a compatible npm lockfile; lifecycle scripts are disabled.');}
 const {readFileSync}=await import('node:fs');const image=readFileSync(imageFile,'utf8').trim();
 event({stage:'dependencies',state:'completed'});
 if(deps)for(const check of checks)check.argv=['sh','-c','ln -s /deps/node_modules /work/node_modules && exec "$@"','qa',...check.argv];
 event({stage:'plan',state:'completed',checks:checks.map(c=>c.name),gaps});
 return {repo,revision:sha,spec:{image,checks},gaps,cleanup};
 }catch(e){cleanup();throw e;}
}
