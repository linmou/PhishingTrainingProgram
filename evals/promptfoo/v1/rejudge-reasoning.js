#!/usr/bin/env node
// Purpose: version a scope-only C01 grader correction across every preserved generation while retaining all unaffected judgments and superseded evidence.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {call,checkedResult,judgeMessages,sha}=require('./runner');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const pause=()=>new Promise(resolve=>setTimeout(resolve,10000));
async function main(){
 const [source,out]=process.argv.slice(2);if(!source||!out)throw new Error('Supply source run and new output directory.');
 const old=read(path.join(source,'snapshot.json'));
 const correction={id:'C01-judge-format-scope-20260907',reason:'The 25-word limit applies only to evaluator verdict.reason, not target reasoning. Rejudge every C01 result; no target resampling or selective failed-grade retry.',judge_source:judgeMessages.toString()};
 const identity={...old,manifest:{...old.manifest,reasoning_grader_correction:correction.id},sources:old.sources,rubrics:old.rubrics,parent_run:source,correction};
 delete identity.fingerprint;delete identity.started_at;delete identity.command;
 const fingerprint=sha(identity);fs.mkdirSync(out,{recursive:true});
 const file=path.join(out,'snapshot.json');
 if(fs.existsSync(file)){if(read(file).fingerprint!==fingerprint)throw new Error('Resume fingerprint mismatch.');}
 else write(file,{...identity,fingerprint,started_at:new Date().toISOString(),command:process.argv});
 const jobs=old.cases.flatMap(c=>Array.from({length:old.settings.repetitions},(_,repetition)=>({c,repetition})));let cursor=0;
 await Promise.all(Array.from({length:6},async()=>{
  while(cursor<jobs.length){
   const {c,repetition}=jobs[cursor++],name=c.id+'-'+repetition+'.json',dest=path.join(out,name);if(fs.existsSync(dest))continue;
   const sourceFile=path.join(source,name);while(!fs.existsSync(sourceFile))await pause();
   const r=read(sourceFile),id='decision_reasoning',rubric=old.rubrics[c.id][id],calls=[];
   let result;
   if(!r.parsed||typeof r.parsed.reasoning!=='string'||!r.parsed.reasoning.trim())result=r.results.find(x=>x.metric===id);
   else{
    let messages=judgeMessages(c,r.parsed,{[id]:rubric});
    for(let attempt=0;attempt<2;attempt++){
     const raw=await call(messages,'judge',old.settings);calls.push(raw);let parsed;try{parsed=JSON.parse(raw.text)?.[id];}catch{parsed=null;}
     result=checkedResult(id,parsed);if(!['error','missing'].includes(result.status)||attempt===1)break;
     messages=[...messages,{role:'user',content:'Return exactly {"decision_reasoning":{"pass":true,"score":1,"reason":"brief verdict evidence"}} or false/0. The target reasoning has no 25-word limit; only your verdict reason does. Repair the JSON format without changing criteria.'}];
    }
   }
   if(!result)throw new Error('Missing source C01 judgment.');
   const previous=r.judge?.filter(j=>j.metric===id)||[];
   write(dest,{...r,rejudged_from:source,superseded_judgments:[...(r.superseded_judgments||[]),{correction:correction.id,results:r.results.filter(x=>x.metric===id),judge:previous}],judge:[...(r.judge||[]).filter(j=>j.metric!==id),{metric:id,result,calls}],results:r.results.map(x=>x.metric===id?result:x)});
   console.log(c.id,repetition,result.status);
  }
 }));
 const report=path.join(out,'report.json');if(!fs.existsSync(report))write(report,{fingerprint,completed_at:new Date().toISOString(),parent_run:source,results:jobs.map(({c,repetition})=>read(path.join(out,c.id+'-'+repetition+'.json')))});
 console.log(JSON.stringify({source,out,generations:jobs.length,changed_check:'decision_reasoning'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
