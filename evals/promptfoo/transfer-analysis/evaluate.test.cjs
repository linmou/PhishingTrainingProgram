#!/usr/bin/env node
// Test responsibility: evaluate.cjs must use the production handler, compare gold decisions, preserve consumer failures, and enforce complete gates.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadProduction,executeTarget,score,summarize,targetState,eligible,baselineEligible}=require('./evaluate.cjs');
const snapshot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../output/transfer-analysis-eval-20261013/production-edge.json')));
const production=loadProduction(snapshot);
function fixture(type='understanding') {
  const message={id:'message-1',room_id:'room-1',user_id:'learner-1',user_role:'student',content:'The fake login captures the password I type.'};
  return {id:'test-1',suite:'development',partition:'full',expected:{kind:'demonstrated_understanding',protection:false,correction:false},input:{focus_student_id:'learner-1',evidence_message_id:'message-1',message,items:[{id:'item-1',area_text:'Explain password capture',item_type:type,priority:'important',status:'pending',understanding_level:'none'}],dialogue_history:[{...message,source:'message',speaker_name:null}]}};
}
function analysis(kind='demonstrated_understanding',type='explanation') {
  return {events:kind?[{item_id:'item-1',kind,evidence_type:type,evidence_message_id:'message-1',evidence_quote:'The fake login captures the password I type.',explanation:'The learner explains password capture.'}]:[],requires_protection:false,requires_correction:false,explanation:'Current learner evidence.'};
}
const transport=(output,finish='stop')=>async request=>({request,status:200,response:{choices:[{finish_reason:finish,message:{content:typeof output==='string'?output:JSON.stringify(output)}}]}});
test('gold full understanding traverses actual handler and reducer and excludes assessment',async()=>{
  const c=fixture();const result=await executeTarget(c,production,transport(analysis()));
  assert.equal(result.http_status,200);assert.equal(result.next_state.status,'covered');assert.equal(result.projected_assessment_due,false);
  assert.ok(score(c,result).every(c=>c.status==='pass'));
  assert.equal(result.calls[0].request.temperature,0);assert.equal(result.calls[0].request.max_tokens,600);assert.equal(result.calls[0].request.enable_thinking,false);
});
test('wrong kind fails even with a fluent explanation and valid JSON',async()=>{
  const c=fixture();Object.assign(c.input.items[0],{status:'partially_covered',understanding_level:'basic'});
  const result=await executeTarget(c,production,transport(analysis('initial_signal')));
  const checks=score(c,result);assert.equal(checks.find(c=>c.metric==='raw_event').status,'fail');assert.equal(checks.find(c=>c.metric==='assessment_route').status,'fail');
});
test('legacy detection-area action filtering is measured separately from raw decision',async()=>{
  const c=fixture('detection_area');const result=await executeTarget(c,production,transport(analysis('demonstrated_understanding','action')));
  assert.equal(result.applied.rejected_events[0].rejection_reason,'EVIDENCE_TYPE_MISMATCH');
  const checks=score(c,result);assert.equal(checks.find(c=>c.metric==='raw_event').status,'pass');assert.equal(checks.find(c=>c.metric==='applied_state').status,'fail');
});
test('invalid JSON, foreign evidence, and truncation stay visible',async()=>{
  const foreign=analysis();foreign.events[0].evidence_message_id='other-message';
  for(const [output,finish] of [['not json','stop'],[foreign,'stop'],[analysis(),'length']]){
    const result=await executeTarget(fixture(),production,transport(output,finish));
    assert.equal(result.http_status,502);assert.equal(result.applied,null);
    assert.equal(score(fixture(),result).find(c=>c.metric==='validity').status,'fail');
    assert.equal(score(fixture(),result).find(c=>c.metric==='applied_state').status,'error');
  }
});
test('sequence state is consumed rather than resetting to gold prior state',async()=>{
  const result=await executeTarget(fixture(),production,transport(analysis()),{status:'needs_review',understanding_level:'basic'});
  assert.equal(result.applied.rejected_events[0].rejection_reason,'INELIGIBLE_TRANSITION');assert.equal(result.next_state.status,'needs_review');
});
// evaluate.cjs: only developed full understanding starts a final assessment, subject to safety priority.
test('only Partial to Covered full understanding is eligible and safety flags defer it',()=>{
  const pending={status:'pending',understanding_level:'none'};
  const partial={status:'partially_covered',understanding_level:'basic'};
  const review={status:'needs_review',understanding_level:'basic'};
  const covered={status:'covered',understanding_level:'good'};
  const safe={protection:false,correction:false};
  assert.equal(eligible(partial,covered,'demonstrated_understanding',safe),true);
  assert.equal(eligible(pending,covered,'demonstrated_understanding',safe),false);
  assert.equal(eligible(pending,partial,'initial_signal',safe),false);
  assert.equal(eligible(review,partial,'post_repair_signal',safe),false);
  assert.equal(eligible(partial,covered,'spontaneous_transfer',safe),false);
  assert.equal(eligible(covered,covered,null,safe),false);
  assert.equal(eligible(partial,covered,'demonstrated_understanding',{...safe,protection:true}),false);
  assert.equal(eligible(partial,covered,'demonstrated_understanding',{...safe,correction:true}),false);
});
// evaluate.cjs and assessment-api/index.ts: real handler input must retain the prior state for routing.
test('full understanding after development reaches Covered and projects assessment readiness',async()=>{
  const c=fixture();Object.assign(c.input.items[0],{status:'partially_covered',understanding_level:'basic'});
  const result=await executeTarget(c,production,transport(analysis()));
  assert.equal(result.http_status,200);assert.equal(result.projected_assessment_due,true);
  assert.ok(score(c,result).every(check=>check.status==='pass'));
});
test('gate includes missing generations and failed pair members',async()=>{
  const c=fixture();c.pair_id='pair';const second={...c,id:'test-2'};
  const frozen={run_id:'test',cases:[c,second],settings:{repetitions:2},expected_generations:4,thresholds:{raw_event:0.8,applied_state:0.8,safety_flags:1,assessment_route:0.8,validity:1},required_suites:['development'],required_partitions:['full']};
  const result=await executeTarget(c,production,transport(analysis()));
  const summary=summarize(frozen,[{case_id:c.id,repetition:0,result,checks:score(c,result)}]);
  assert.equal(summary.missing_generations,3);assert.equal(summary.rows[0].expected,4);assert.equal(summary.rows[0].missing,3);assert.ok(summary.pairs.every(p=>!p.pass));
  assert.equal(summary.interactions[0].unevaluable,3);assert.notEqual(summary.verdict,'accepted');
});
test('all passing scores cannot confer human label approval',async()=>{
  const c=fixture();const frozen={run_id:'test',cases:[c],settings:{repetitions:1},expected_generations:1,thresholds:{raw_event:0.8,applied_state:0.8,safety_flags:1,assessment_route:0.8,validity:1},required_suites:['development'],required_partitions:['full']};
  const result=await executeTarget(c,production,transport(analysis()));
  const summary=summarize(frozen,[{case_id:c.id,repetition:0,result,checks:score(c,result)}]);
  assert.ok(summary.rows.every(r=>r.verdict==='pass'));assert.equal(summary.verdict,'incomplete');
});

// evaluate.cjs: compare the old and revised routes against one explicit revised gold expectation.
test('paired routing isolates the timing change without improving semantic scores artificially',async()=>{
  const c=fixture();Object.assign(c.input.items[0],{status:'partially_covered',understanding_level:'basic'});
  c.expected.assessment_due=true;
  const old=await executeTarget(c,production,transport(analysis()),null,baselineEligible);
  const revised=await executeTarget(c,production,transport(analysis()),null,eligible);
  assert.equal(score(c,old).find(k=>k.metric==='assessment_route').status,'fail');
  assert.equal(score(c,revised).find(k=>k.metric==='assessment_route').status,'pass');
  assert.deepEqual(score(c,old).filter(k=>k.metric!=='assessment_route'),score(c,revised).filter(k=>k.metric!=='assessment_route'));
  assert.deepEqual(old.calls[0].request,revised.calls[0].request);
});
