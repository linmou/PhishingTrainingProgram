#!/usr/bin/env node
// Purpose: recover invalid primary judge records once with identical requests, retaining original evidence and the failed disclosure-calibration status.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,read,save,sha}=require('./prepare.cjs');
const {settings,parseJudgment}=require('./run.cjs'),{call}=require('../../v1/runner');
async function main(runDirectory){
 const env=require(path.join(root,'tutor-system/node_modules/dotenv')).parse(fs.readFileSync('/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env'));if(env.OAI_MODEL)assert.equal(env.OAI_MODEL,settings.model);for(const key of ['OAI_BASE_URL','OAI_API_KEY']){assert(env[key]);process.env[key]=env[key];}
 const source=path.join(runDirectory,'primary'),out=path.join(runDirectory,'primary-repairs'),metrics=read(path.join(runDirectory,'frozen.json')).rubric.primary;
 const invalid=fs.readdirSync(source).filter(f=>f.endsWith('.json')).map(f=>({file:f,record:read(path.join(source,f))})).filter(x=>x.record.error);
 const segments=path.join(__dirname,'raw/budget-segments'),old=path.join(__dirname,'raw/calibration-v1'),calls=fs.readdirSync(old).filter(f=>f.endsWith('.json')&&f!=='frozen.json'&&!f.startsWith('summary')).flatMap(f=>read(path.join(old,f)).raw?.attempts||[]);
 const initial=Math.max(...calls.map(x=>Date.parse(x.completed)))-Math.min(...calls.map(x=>Date.parse(x.started))),prior=fs.readdirSync(segments).reduce((n,f)=>n+read(path.join(segments,f)).elapsed_ms,initial),started=Date.now(),segmentFile=path.join(segments,started+'.json');
 const update=()=>fs.writeFileSync(segmentFile,JSON.stringify({started_at:new Date(started).toISOString(),elapsed_ms:Date.now()-started,prior_elapsed_ms:prior,max_active_ms:1800000,model:settings.model})+'\n');
 const records=[];
 for(const {file,record}of invalid){const f=path.join(out,file);if(fs.existsSync(f)){records.push(read(f));continue;}assert(prior+Date.now()-started<1800000,'Active model-execution budget exhausted');let raw;try{raw=await call(record.messages,'judge',settings);}finally{update();}assert.deepEqual(raw.request,record.raw.request);assert.equal(raw.endpoint,record.raw.endpoint);const parsed=parseJudgment(raw,metrics),r={id:record.id,source_file:path.relative(__dirname,path.join(source,file)),source_sha256:sha(record),retry_policy:'one identical-request invalid-output repair only',messages:record.messages,raw,...parsed};save(f,r);records.push(r);console.log(r.id,parsed.error||'recovered');}
 const summary={expected:invalid.length,recovered:records.filter(x=>!x.error).length,errors:records.filter(x=>x.error).map(x=>({id:x.id,error:x.error})),mapping:records.map(x=>({id:x.id,source_file:x.source_file,source_sha256:x.source_sha256,repair_file:path.relative(__dirname,path.join(out,x.id+'.json'))}))};save(path.join(out,'summary-'+Date.now()+'.json'),summary);console.log(JSON.stringify(summary));if(summary.errors.length)process.exitCode=1;
}
if(require.main===module)main(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
