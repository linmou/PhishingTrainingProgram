#!/usr/bin/env node
// Purpose: make one identical-request retry only for invalid secondary judge records, retaining original errors and explicit recovery provenance.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,read,save,sha}=require('./prepare.cjs');
const {settings,parseJudgment}=require('./run.cjs'),{call}=require('../../v1/runner');
async function main(){
 const envFile=process.env.PTP_EVAL_ENV_FILE||'/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env';
 const env=require(path.join(root,'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(envFile));if(env.OAI_MODEL)assert.equal(env.OAI_MODEL,settings.model);for(const key of ['OAI_BASE_URL','OAI_API_KEY']){assert(env[key]);process.env[key]=env[key];}
 const source=path.join(__dirname,'raw/comparison-v1/secondary'),out=path.join(__dirname,'raw/secondary-repairs'),rubrics=read(path.join(__dirname,'rubrics.json')).secondary;
 const invalid=fs.readdirSync(source).filter(f=>f.endsWith('.json')).map(f=>({file:f,record:read(path.join(source,f))})).filter(x=>x.record.error);
 assert.equal(invalid.length,3,'This bounded recovery was authorized for exactly three invalid outputs');
 const segments=path.join(__dirname,'raw/budget-segments'),old=path.join(__dirname,'raw/calibration-v1');
 const calls=fs.readdirSync(old).filter(f=>f.endsWith('.json')&&f!=='frozen.json'&&!f.startsWith('summary')).flatMap(f=>read(path.join(old,f)).raw?.attempts||[]);
 const failedSpan=Math.max(...calls.map(x=>Date.parse(x.completed)))-Math.min(...calls.map(x=>Date.parse(x.started)));
 const prior=fs.readdirSync(segments).reduce((n,f)=>n+read(path.join(segments,f)).elapsed_ms,failedSpan),started=Date.now(),segmentFile=path.join(segments,started+'.json');
 const update=()=>fs.writeFileSync(segmentFile,JSON.stringify({started_at:new Date(started).toISOString(),elapsed_ms:Date.now()-started,prior_elapsed_ms:prior,max_active_ms:1800000,model:settings.model})+'\n');
 const manifest=[];
 for(const {file,record}of invalid){
  const target=path.join(out,file);if(fs.existsSync(target)){manifest.push(read(target));continue;}
  assert(prior+Date.now()-started<1800000,'Active execution budget exhausted');
  let raw;try{raw=await call(record.messages,'judge',settings);}finally{update();}
  assert.deepEqual(raw.request,record.raw.request,'Retry must preserve exact request');assert.equal(raw.endpoint,record.raw.endpoint,'Retry endpoint drift');
  const parsed=parseJudgment(raw,rubrics),r={id:record.id,source_file:path.relative(__dirname,path.join(source,file)),source_sha256:sha(record),retry_policy:'one identical-request invalid-output repair; valid verdicts never resampled',messages:record.messages,raw,...parsed};save(target,r);manifest.push(r);console.log(record.id,parsed.error||'recovered');
 }
 const summary={expected:3,recovered:manifest.filter(x=>!x.error).length,errors:manifest.filter(x=>x.error).map(x=>({id:x.id,error:x.error})),mapping:manifest.map(x=>({id:x.id,source_file:x.source_file,source_sha256:x.source_sha256,repair_file:'raw/secondary-repairs/'+x.id+'.json'}))};save(path.join(out,'summary-'+Date.now()+'.json'),summary);console.log(JSON.stringify(summary));if(summary.errors.length)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
