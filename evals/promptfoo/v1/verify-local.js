#!/usr/bin/env node
// Purpose: record local evaluation-harness and product-contract regression tests with commands, exit codes, timestamps and unfiltered logs.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const out=process.argv[2];if(!out)throw new Error('Supply a new verification JSON path.');
const jobs=[
 {cwd:root,args:['node','--test','evals/promptfoo/rubrics/v1/decision-metrics.test.js','evals/promptfoo/v1/harness.test.js','evals/promptfoo/v1/analyze.test.js']},
 {cwd:path.join(root,'tutor-system'),args:['npm','test','--','--watch=false','--runInBand','--runTestsByPath','src/services/__tests__/tutorDecisionContract.test.ts','src/services/__tests__/aiService.guardMode.test.ts','src/services/__tests__/guardModeService.test.ts','src/components/__tests__/AISuggestionBox.guardMode.test.tsx']},
 {cwd:path.join(root,'tutor-system'),args:['./node_modules/.bin/tsc','--noEmit','--skipLibCheck','--target','ES2020','--moduleResolution','node','--esModuleInterop','src/services/tutorDecisionContract.ts']}
];
const results=jobs.map(job=>{
 const started=new Date().toISOString(),r=cp.spawnSync('rtk',['proxy',...job.args],{cwd:job.cwd,env:{...process.env,CI:'true'},encoding:'utf8',maxBuffer:16*1024*1024});
 console.log(JSON.stringify({command:job.args.join(' '),exit_code:r.status}));
 return {...job,started,completed:new Date().toISOString(),exit_code:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message||null};
});
const git=args=>cp.execFileSync('rtk',['proxy','git',...args],{cwd:root,encoding:'utf8'});
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({created_at:new Date().toISOString(),revision:git(['rev-parse','HEAD']).trim(),worktree:git(['status','--short']),results,limitations:['Scoped TypeScript check only; repository-wide tsc has unrelated existing errors. No live browser, database migration or deployed contract change is claimed.']},null,2)+'\n',{flag:'wx'});
if(results.some(r=>r.exit_code!==0))process.exitCode=1;
