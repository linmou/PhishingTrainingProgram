#!/usr/bin/env node
// Purpose: preserve full-run failure dispositions, same-output metric interactions and provider usage without hiding incomplete evidence.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {assess}=require('./gate');
const {sha}=require('./runner');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const pairs=[['instruction_selection','instruction_realization'],['instruction_realization','learning_state_target'],['mode_selection','decision_reasoning'],['disruption_correction','guard_tone_safety'],['contextual_knowledge_quality','response_length']];
function analyze(report,snapshot){
 const interactions=[];
 for(const [a,b] of pairs){
  for(const partition of ['overall',...new Set(snapshot.cases.map(c=>'source:'+c.source_type))]){
   const row={a,b,partition,both_pass:0,a_only:0,b_only:0,both_fail:0,unevaluable:0,conditional_na:0,expected:0,witnesses:[]};
   for(const c of snapshot.cases){
    if(!c.expected.checks.includes(a)||!c.expected.checks.includes(b)||!(partition==='overall'||partition==='source:'+c.source_type))continue;
    for(let repetition=0;repetition<snapshot.settings.repetitions;repetition++){
     row.expected++;
     const r=report.results.find(r=>r.case_id===c.id&&r.repetition===repetition);
     const x=r?.results.find(x=>x.metric===a),y=r?.results.find(x=>x.metric===b);
     let outcome;
     if(!x||!y||[x.status,y.status].some(s=>['error','missing'].includes(s)))outcome='unevaluable';
     else if([x.status,y.status].includes('not_applicable'))outcome='conditional_na';
     else outcome=x.status==='pass'?(y.status==='pass'?'both_pass':'a_only'):(y.status==='pass'?'b_only':'both_fail');
     row[outcome]++;row.witnesses.push({case_id:c.id,repetition,generation:r?.target_generation||null,outcome});
    }
   }
   interactions.push(row);
  }
 }
 const failures=report.results.flatMap(r=>r.results.filter(x=>!['pass','not_applicable'].includes(x.status)).map(x=>({case_id:r.case_id,repetition:r.repetition,generation:r.target_generation,...x})));
 const usage={target_tokens:0,judge_tokens:0,target_requests:0,judge_requests:0,replayed_generations:0};
 for(const r of report.results){
  if(r.replay_source||r.rejudged_from)usage.replayed_generations++;
  if(Array.isArray(r.new_target_calls)&&!r.rejudged_from){for(const call of r.new_target_calls){usage.target_requests+=call.attempts?.length||0;usage.target_tokens+=call.payload?.usage?.total_tokens||0;}}
  else if(!r.replay_source&&!r.rejudged_from){usage.target_requests+=r.target.attempts?.length||0;usage.target_tokens+=r.target.payload?.usage?.total_tokens||0;}
  for(const j of r.judge||[]){
   if(j.reused_from||(r.rejudged_from&&j.metric!=='decision_reasoning'))continue;
   for(const call of j.new_calls||j.calls||[]){usage.judge_requests+=call.attempts?.length||0;usage.judge_tokens+=call.payload?.usage?.total_tokens||0;}
  }
 }
 return {interactions,failures,usage};
}
if(require.main===module){
 const directory=process.argv[2],baseline=process.argv[3];
 if(!directory)throw new Error('Supply run directory and optional baseline.');
 const report=read(path.join(directory,'report.json')),snapshot=read(path.join(directory,'snapshot.json'));
 const comparison=assess(report,snapshot,baseline?read(path.join(baseline,'report.json')):null,baseline?read(path.join(baseline,'snapshot.json')):null);
 const result={created_at:new Date().toISOString(),run:directory,baseline:baseline||null,snapshot_sha256:sha(fs.readFileSync(path.join(directory,'snapshot.json'),'utf8')),gate_source:fs.readFileSync(path.join(__dirname,'gate.js'),'utf8'),comparison,...analyze(report,snapshot)};
 fs.writeFileSync(path.join(directory,'analysis.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({verdict:comparison.verdict,issues:comparison.issues.length,usage:result.usage}));
}
module.exports={analyze};
