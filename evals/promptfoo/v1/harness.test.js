#!/usr/bin/env node
// Purpose: validate runner.js and gate.js integration for scoped judge evidence, typed errors, complete denominators and baseline non-regression.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {call,checkedResult,judgeMessages,messagesFor,generateTarget,reusableJudgment,transportAttemptsRemaining}=require('./runner');
const {assess}=require('./gate');
function fixture(n=1){
 const cases=Array.from({length:n},(_,i)=>({id:'case-'+i,source_type:'ecological',role:'peer',input:{prior_mode:null},expected:{mode:'tutoring',checks:['mode_selection']},partitions:[],legacy:[]}));
 const snapshot={cases,settings:{repetitions:1},rubrics:{},manifest:JSON.parse(JSON.stringify(require('../rubrics/v1/manifest.json')))};
 const report={results:cases.map(c=>({case_id:c.id,repetition:0,input:c,source_type:c.source_type,role:c.role,partitions:[],parsed:{mode:'tutoring'},results:[{metric:'mode_selection',method:'deterministic',status:'pass',pass:true,score:1}]}))};
 return {snapshot,report};
}
test('typed semantic results preserve failure, inapplicability, errors and absent judgments',()=>{
 assert.equal(checkedResult('reading_level',{pass:false,score:0,reason:'Dense unexplained jargon'}).status,'fail');
 assert.equal(checkedResult('reading_level',undefined).status,'missing');
 assert.equal(checkedResult('reading_level',{pass:true,score:0,reason:'bad'}).status,'error');
 assert.equal(checkedResult('reading_level',{applicable:false,pass:null,score:null,reason:'skip'}).status,'error');
 assert.equal(checkedResult('contribution_feedback',{applicable:false,pass:null,score:null,reason:'No acknowledgment'}).status,'not_applicable');
 assert.equal(checkedResult('contextual_knowledge_quality',{pass:true,score:1,accuracy_pass:false,reason:'False claim'}).status,'error');
 assert.equal(checkedResult('contextual_knowledge_quality',{applicable:false,pass:null,score:null,reason:'absent'}).status,'error');
});
test('judge evidence hides decision reasoning from tone/knowledge while exposing it to C01',()=>{
 const c={input:{student_message:'data'},role:'peer',inventory:{},expected:{knowledge_required:false}};
 const output={reasoning:'secret justification',mode:'guard',decision:{instruction:null},suggested_response:'Stop interrupting.'};
 const body=JSON.parse(judgeMessages(c,output,{guard_tone_safety:'tone',decision_reasoning:'explanation'})[1].content);
 assert.deepEqual(body.checks.guard_tone_safety.output,{suggested_response:'Stop interrupting.'});
 assert.equal(body.checks.decision_reasoning.output.reasoning,'secret justification');
 assert.equal(body.evidence.output,undefined);
});
test('target builder never renders expected labels or rubric annotations',()=>{
 const c={input:{student_message:'I would click.',prior_mode:null},baseline_system:'room config',expected:{mode:'tutoring',instruction:['protective_instruction'],knowledge_required:true},id:'hidden-case-name'};
 const text=JSON.stringify(messagesFor(c,'candidate','policy'));
 assert(!text.includes('expected'));assert(!text.includes('knowledge_required'));assert(!text.includes('hidden-case-name'));
 assert(text.includes('I would click.'));
});
test('gate accepts complete passing evidence and rejects missing/duplicate generations',()=>{
 const {snapshot,report}=fixture();assert.equal(assess(report,snapshot).verdict,'accepted');
 assert(assess({results:[]},snapshot).issues.some(i=>i.type==='missing_generation'));
 assert(assess({results:[...report.results,...report.results]},snapshot).issues.some(i=>i.type==='duplicate_generation'));
});
test('zero-component failures and missing metrics remain blocking',()=>{
 const {snapshot,report}=fixture();report.results[0].results=[];
 assert(assess(report,snapshot).issues.some(i=>i.type==='missing_assertion'));
});
test('80 percent does not hide same-case regression from 100 percent',()=>{
 const {snapshot,report}=fixture(10),baseline=JSON.parse(JSON.stringify(report));
 Object.assign(report.results[0].results[0],{status:'fail',pass:false,score:0});
 const result=assess(report,snapshot,baseline,snapshot);
 assert(result.issues.some(i=>i.type==='regression'));assert.equal(result.new_failures.length,1);
});
test('changed baseline settings cannot establish non-regression',()=>{
 const {snapshot,report}=fixture();const old={...snapshot,settings:{repetitions:2}};
 assert(assess(report,snapshot,report,old).issues.some(i=>i.type==='incomparable_baseline'));
});
test('judge errors remain in denominators',()=>{
 const {snapshot,report}=fixture();Object.assign(report.results[0].results[0],{status:'error',pass:false,score:0});
 const result=assess(report,snapshot);assert(result.issues.some(i=>i.type==='unevaluable_assertion'));assert.equal(result.metrics[0].applicable,1);
});
test('a required-content omission cannot become inapplicable',()=>{
 const {snapshot,report}=fixture();snapshot.cases[0].expected={checks:['contextual_knowledge_quality'],knowledge_required:true};report.results[0].input=snapshot.cases[0];report.results[0].results=[{metric:'contextual_knowledge_quality',method:'llm_rubric',status:'not_applicable',applicable:false,pass:null,score:null}];
 assert(assess(report,snapshot).issues.some(i=>i.type==='required_content_excluded'));
});
test('accuracy hard failure blocks even a high quality rate',()=>{
 const {snapshot,report}=fixture(10);for(let i=0;i<10;i++){snapshot.cases[i].expected.checks=['contextual_knowledge_quality'];report.results[i].results=[{metric:'contextual_knowledge_quality',method:'llm_rubric',status:i?'pass':'fail',pass:!!i,score:i?1:0,accuracy_pass:!!i}];}
 assert(assess(report,snapshot).issues.some(i=>i.type==='H1_accuracy'));
});
test('exact transition cannot be inferred from absent prior state',()=>{
 const {snapshot,report}=fixture();snapshot.cases[0].transition={from:'guard',to:'tutoring'};
 assert(assess(report,snapshot).issues.some(i=>i.type==='transition'));
});
test('both members of a declared pair must pass',()=>{
 const {snapshot,report}=fixture(2);for(const c of snapshot.cases)c.pair_id='pair';Object.assign(report.results[0].results[0],{status:'fail',pass:false,score:0});
 assert(assess(report,snapshot).issues.some(i=>i.type==='pair'));
});
test('gate uses frozen thresholds, not a later working manifest',()=>{
 const {snapshot,report}=fixture(10);
 snapshot.manifest.checks.find(c=>c.id==='mode_selection').threshold=1;
 Object.assign(report.results[0].results[0],{status:'fail',pass:false,score:0});
 assert(assess(report,snapshot).issues.some(i=>i.type==='below_threshold'&&i.threshold===1));
});
test('target thinking is an explicit configured request factor, independent of judge thinking',async()=>{
 const originalFetch=global.fetch,originalKey=process.env.REACT_APP_OAI_API_KEY,originalUrl=process.env.REACT_APP_OAI_BASE_URL;
 process.env.REACT_APP_OAI_API_KEY='mock-test-key';process.env.REACT_APP_OAI_BASE_URL='https://not-called.invalid';
 global.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'{}'}}]})});
 try{
  const settings={model:'configured-model',target_temperature:0.3,judge_temperature:0,target_max_tokens:8000,judge_max_tokens:8000,target_enable_thinking:true,judge_enable_thinking:true,transport_attempts:1,timeout_ms:1000};
  assert.equal((await call([],'target',settings)).request.enable_thinking,true);
  assert.equal((await call([],'target',{...settings,target_enable_thinking:false})).request.enable_thinking,false);
  assert.equal((await call([],'judge',{...settings,target_enable_thinking:false})).request.enable_thinking,true);
 }finally{
  global.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.REACT_APP_OAI_API_KEY;else process.env.REACT_APP_OAI_API_KEY=originalKey;
  if(originalUrl===undefined)delete process.env.REACT_APP_OAI_BASE_URL;else process.env.REACT_APP_OAI_BASE_URL=originalUrl;
 }
});
test('judge output word limit never becomes a target reasoning requirement',()=>{
 const c={input:{},role:'peer',inventory:{},expected:{knowledge_required:false}};
 const messages=judgeMessages(c,{reasoning:'observable evidence',suggested_response:'one question'},{decision_reasoning:'rubric'});
 assert(messages[0].content.includes('do not impose a 25-word limit on the target reasoning field'));
});
test('Guard scope clarification permits optional task content without excusing missing discussion impact',()=>{
 const c={input:{},role:'peer',inventory:{},expected:{knowledge_required:false}};
 const prompt=judgeMessages(c,{suggested_response:'Stop derailing the discussion.'},{disruption_correction:'rubric'})[0].content;
 assert(prompt.includes('NEITHER required NOR prohibited'));
 assert(prompt.includes('Missing discussion impact can still fail'));
 assert(!judgeMessages(c,{}, {reading_level:'rubric'})[0].content.includes('NEITHER required NOR prohibited'));
});
test('transport recovery respects total attempt budget and excludes semantic and permanent failures',()=>{
 const settings={transport_attempts:3};
 assert.equal(transportAttemptsRemaining({error:'HTTP 429',attempts:[{status:429},{status:429}]},settings),1);
 assert.equal(transportAttemptsRemaining({error:'timeout',attempts:[{error:'timeout'},{error:'timeout'},{error:'timeout'}]},settings),0);
 assert.equal(transportAttemptsRemaining({error:'HTTP 401',attempts:[{status:401}]},settings),0);
 assert.equal(transportAttemptsRemaining({text:'valid but incorrect',attempts:[{status:200}]},settings),0);
});
test('judgment reuse requires exact evidence, criterion and provider request settings; failed grades are not selectively retried',()=>{
 const messages=[{role:'user',content:'same input and rubric'}],settings={model:'m',judge_temperature:0,judge_max_tokens:8000,judge_enable_thinking:true};
 const item={result:{pass:false},calls:[{request:{messages,model:'m',temperature:0,max_tokens:8000,enable_thinking:true}}]};
 assert(reusableJudgment(item,messages,settings));
 assert(!reusableJudgment(item,[{role:'user',content:'changed criterion'}],settings));
 assert(!reusableJudgment(item,messages,{...settings,judge_max_tokens:9000}));
 assert(!reusableJudgment(item,messages,{...settings,judge_enable_thinking:false}));
});
test('format repair preserves initial output, never retries valid wrong labels, and stops after one failed repair',async()=>{
 const originalFetch=global.fetch,originalKey=process.env.REACT_APP_OAI_API_KEY,originalUrl=process.env.REACT_APP_OAI_BASE_URL;
 process.env.REACT_APP_OAI_API_KEY='mock-test-key';process.env.REACT_APP_OAI_BASE_URL='https://not-called.invalid';
 const settings={model:'m',target_temperature:0.3,target_max_tokens:8000,target_enable_thinking:true,target_format_attempts:2,transport_attempts:1,timeout_ms:1000};
 const messages=[{role:'user',content:'data'}],valid=JSON.stringify({reasoning:'Observable evidence.',mode:'guard',mode_reason:'Deliberate disruption.',decision:{instruction:null},suggested_response:'Stop interrupting.'});
 let requests=0;
 global.fetch=async()=>{requests++;return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'{}'}}]})};};
 try{
  const replay={request:{messages},text:valid};
  assert.equal((await generateTarget(messages,'candidate',settings,replay)).target,replay);assert.equal(requests,0);
  const malformed={request:{messages},text:'{}'};
  const repaired=await generateTarget(messages,'candidate',settings,malformed);
  assert.equal(requests,1);assert.equal(repaired.target.format_repair.initial,malformed);assert.equal(repaired.calls.length,1);
  await generateTarget(messages,'candidate',settings,repaired.target);assert.equal(requests,1);
  const failedTransport={request:{messages},error:'HTTP 500'};
  await generateTarget(messages,'candidate',settings,failedTransport);assert.equal(requests,1);
  await assert.rejects(generateTarget([{role:'user',content:'different'}],'candidate',settings,replay),/differs/);
 }finally{
  global.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.REACT_APP_OAI_API_KEY;else process.env.REACT_APP_OAI_API_KEY=originalKey;
  if(originalUrl===undefined)delete process.env.REACT_APP_OAI_BASE_URL;else process.env.REACT_APP_OAI_BASE_URL=originalUrl;
 }
});
