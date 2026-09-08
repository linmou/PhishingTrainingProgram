#!/usr/bin/env node
// Purpose: preserve a complete target-generation preflight with deterministic diagnostics before spending on full semantic judging; this is never an acceptance run.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {generateTarget,messagesFor,sha}=require('./runner');
const metrics=require('../rubrics/v1/decision-metrics');
const length=require('../rubrics/v0/response-length-rubric');
async function main(){
 const [caseFile,policyFile,out,contractVersion='legacy']=process.argv.slice(2);
 if(!caseFile||!policyFile||!out)throw new Error('Supply cases, policy, and new output directory.');
 const cases=JSON.parse(fs.readFileSync(caseFile,'utf8')),policy=fs.readFileSync(policyFile,'utf8'),settings=JSON.parse(fs.readFileSync(path.join(__dirname,'settings.json'),'utf8'));
 const identity={cases,policy,settings,contract_version:contractVersion,runner_source:fs.readFileSync(path.join(__dirname,'runner.js'),'utf8')},fingerprint=sha(identity);
 fs.mkdirSync(out,{recursive:true});
 const snapshot=path.join(out,'snapshot.json');
 if(fs.existsSync(snapshot)){if(JSON.parse(fs.readFileSync(snapshot,'utf8')).fingerprint!==fingerprint)throw new Error('Resume fingerprint mismatch.');}
 else fs.writeFileSync(snapshot,JSON.stringify({fingerprint,started_at:new Date().toISOString(),purpose:'Target-only diagnostic; all semantic gates unrun',...identity},null,2)+'\n',{flag:'wx'});
 const jobs=cases.flatMap(c=>Array.from({length:settings.repetitions},(_,repetition)=>({c,repetition})));let cursor=0;
 await Promise.all(Array.from({length:6},async()=>{
  while(cursor<jobs.length){
   const {c,repetition}=jobs[cursor++],file=path.join(out,c.id+'-'+repetition+'.json');if(fs.existsSync(file))continue;
   const generated=await generateTarget(messagesFor(c,'candidate',policy,contractVersion),'candidate',settings,undefined,contractVersion),target=generated.target;let parsed;try{parsed=JSON.parse(target.text);}catch{parsed=null;}
   const ctx={vars:{expected_mode:c.expected.mode,expected_instruction:c.expected.instruction}};
   const parsedForEvaluation=contractVersion==='v2'&&parsed?{...parsed,reasoning:parsed.reason,mode:parsed.decision?.mode,mode_reason:parsed.reason,suggested_response:parsed.response}:parsed;
   const results=[contractVersion==='v2'?metrics.contractValidityV2(target.text):metrics.contractValidity(target.text),contractVersion==='v2'?metrics.modeSelectionV2(target.text,ctx):metrics.modeSelection(target.text,ctx),{metric:'response_length',...length(parsedForEvaluation?.suggested_response)}];
   if(c.expected.checks.includes('instruction_selection'))results.push(contractVersion==='v2'?metrics.instructionSelectionV2(target.text,ctx):metrics.instructionSelection(target.text,ctx));
   fs.writeFileSync(file,JSON.stringify({case_id:c.id,repetition,target_generation:target.payload?.id||null,new_target_calls:generated.calls,input:c,target,parsed,parsed_for_evaluation:parsedForEvaluation,results,semantic_status:'unrun',contract_version:contractVersion},null,2)+'\n',{flag:'wx'});
   console.log(c.id,repetition,results.filter(r=>!r.pass).map(r=>r.metric).join(',')||'deterministic-pass');
  }
 }));
 const results=jobs.map(({c,repetition})=>JSON.parse(fs.readFileSync(path.join(out,c.id+'-'+repetition+'.json'),'utf8')));
 const summary={completed_at:new Date().toISOString(),generations:results.length,semantic_status:'unrun',failures:results.flatMap(r=>r.results.filter(x=>!x.pass).map(x=>({case_id:r.case_id,repetition:r.repetition,...x})))};
 const file=path.join(out,'preflight.json');if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({generations:summary.generations,deterministic_failures:summary.failures.length,semantic_status:'unrun'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
