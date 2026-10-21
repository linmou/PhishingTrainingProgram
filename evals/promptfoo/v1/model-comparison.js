#!/usr/bin/env node
// Purpose: compare a new target model against saved tutor/transfer outputs with fixed prompts, judges and resumable evidence.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const runner = require('./runner');
const evaluator = require('./evaluator');
const {assess} = require('./gate');
const {analyze} = require('./analyze');
const tutorClassification = require('./classification');
const current = require('../learning-progress-analyzer/current.cjs');
const transfer = require('../learning-progress-analyzer/evaluate.cjs');
const {classificationReport} = require('../learning-progress-analyzer/classification.cjs');
const root = path.resolve(__dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
function save(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2)+'\n', {flag:'wx'});
}
function fixedModel(target, model) {
  return {...target, createAssessmentApiHandler: deps => target.createAssessmentApiHandler({
    ...deps, env: name => name === 'OAI_MODEL' ? model : deps.env(name)
  })};
}
function modelSnapshot(snapshot,model) {
  const copy=structuredClone(snapshot),file=copy.files.find(f=>f.name==='supabase/functions/assessment-api/index.ts');
  const pin="const PROVIDER_MODEL = 'qwen3.5-flash';";
  assert.equal(file.content.split(pin).length,2,'Frozen provider model pin is missing or ambiguous');
  file.content=file.content.replace(pin,'const PROVIDER_MODEL = '+JSON.stringify(model)+';');
  file.sha256=hash(file.content);return copy;
}
function matchingRequest(target, original, model) {
  const first=target.format_repair?.initial||target;
  assert.deepEqual({...first.request,model},original);
  if(target.format_repair)assert.deepEqual(target.request.messages,require('./product-adapter').productionRepair(original.messages));
  assert.deepEqual({...target.request,model,messages:original.messages},original);
}
function sources() {
  return [__filename, ...['runner.js','evaluator.js','gate.js','product-adapter.js'].map(f=>path.join(__dirname,f)),
    ...['current.cjs','evaluate.cjs','classification.cjs'].map(f=>path.join(__dirname,'../learning-progress-analyzer',f)),
    ...fs.readdirSync(path.join(__dirname,'../rubrics/v1')).filter(f=>f.endsWith('.md')||f.endsWith('.js')||f==='manifest.json').map(f=>path.join(__dirname,'../rubrics/v1',f)),
    ...fs.readdirSync(path.join(__dirname,'../rubrics/v0')).filter(f=>f.endsWith('.md')||f.endsWith('.js')).map(f=>path.join(__dirname,'../rubrics/v0',f)),
    ...['analyze.js','classification.js'].map(f=>path.join(__dirname,f)),
    ...evaluator.manifest.sources.map(s=>path.join(root,s.path)),
    ...['proposal','audit','calibration_evidence'].map(k=>evaluator.manifest.revision[k]).filter(Boolean).map(f=>path.join(root,f))]
    .map(file=>({path:path.relative(root,file),content:fs.readFileSync(file,'utf8')}));
}
async function freeze(out, tutorDir, transferDir, model) {
  if(fs.existsSync(out)) throw Error('New directory required');
  const tutor=read(path.join(tutorDir,'snapshot.json'));
  const frozen=read(path.join(transferDir,'frozen.json'));
  current.validateManifest(frozen);
  const rows=await current.generations(transferDir,frozen);
  assert.equal(rows.length,frozen.expected_generations);
  const targets=tutor.cases.flatMap(c=>Array.from({length:tutor.settings.repetitions},(_,repetition)=>{
    const file=path.join(tutorDir,`${c.id}-${repetition}.json`),record=read(file);
    assert.equal(record.fingerprint,tutor.fingerprint);
    assert.deepEqual(record.input,c);
    assert.equal(record.repetition,repetition);
    assert.equal(record.target.request.model,tutor.settings.model);
    const first=record.target.format_repair?.initial||record.target;
    for(const request of [first.request,record.target.request]){
      assert.equal(request.temperature,tutor.settings.target_temperature);assert.equal(request.max_tokens,tutor.settings.target_max_tokens);
      assert.equal(request.enable_thinking,Boolean(tutor.settings.target_enable_thinking));assert.deepEqual(request.response_format,{type:'json_object'});
    }
    matchingRequest(record.target,first.request,tutor.settings.model);
    return {case_id:c.id,repetition,file:path.relative(root,file),sha256:hash(fs.readFileSync(file,'utf8'))};
  }));
  const manifest={created_at:new Date().toISOString(),model,judge_model:tutor.settings.model,
    changed_factors:['target model only; operational workers are configurable'],
    scope:'Exact frozen tutor07 without the later release Guard addition; exact transfer02. Existing exposed cases are regression coverage, not unseen validation.',
    tutor_reference:path.relative(root,tutorDir),transfer_reference:path.relative(root,transferDir),
    tutor,transfer:frozen,tutor_targets:targets,transfer_records:rows.map(g=>({file:path.relative(root,path.join(transferDir,'generations',`${g.case_id}-r${g.repetition}.json`)),sha256:hash(JSON.stringify(g))})),
    candidate_transfer_snapshot:modelSnapshot(frozen.snapshot,model),
    evaluator_manifest:evaluator.manifest,rubrics:Object.fromEntries(tutor.cases.map(c=>[c.id,evaluator.rubricsFor(c)])),sources:sources()};
  save(path.join(out,'manifest.json'),manifest);
  console.log(JSON.stringify({out,manifest_sha256:hash(manifest),tutor_records:targets.length,transfer_records:rows.length,model}));
  return manifest;
}
function validate(out) {
  const manifest=read(path.join(out,'manifest.json'));
  for(const source of manifest.sources) assert.equal(hash(fs.readFileSync(path.join(root,source.path),'utf8')),hash(source.content),'Source drift: '+source.path);
  for(const target of manifest.tutor_targets) assert.equal(hash(fs.readFileSync(path.join(root,target.file),'utf8')),target.sha256,'Baseline target drift');
  for(const target of manifest.transfer_records) assert.equal(hash(JSON.stringify(read(path.join(root,target.file)))),target.sha256,'Baseline transfer drift');
  return manifest;
}
async function pool(jobs, workers) {
  let cursor=0;
  await Promise.all(Array.from({length:workers},async()=>{while(cursor<jobs.length) await jobs[cursor++]();}));
}
function limiter(workers) {
  let active=0;const queue=[];
  return async fn=>{if(active>=workers) await new Promise(resolve=>queue.push(resolve));active++;try{return await fn();}finally{active--;queue.shift()?.();}};
}
async function run(out,workers) {
  if(!Number.isInteger(workers)||workers<1||workers>48) throw Error('num_workers must be 1–48');
  const m=validate(out),fingerprint=hash(m);
  const env={...require(path.join(root,'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'tutor-system/.env'))),...process.env};
  if(!env.OAI_API_KEY||!env.OAI_BASE_URL||env.OAI_MODEL!==m.model) throw Error('Configured provider and matching OAI_MODEL required');
  const limited=limiter(workers),endpoint=env.OAI_BASE_URL.replace(/\/$/,'');
  save(path.join(out,`session-${Date.now()}.json`),{started_at:new Date().toISOString(),command:process.argv,workers,endpoint,fingerprint});
  const judgeSettings={...m.tutor.settings,model:m.judge_model},pendingJudgments=new Map();
  const judgeCall=async messages=>{
    const key=hash({messages,settings:judgeSettings}),file=path.join(out,'judge-cache',key+'.json');
    if(fs.existsSync(file)) return read(file);
    if(pendingJudgments.has(key)) return pendingJudgments.get(key);
    const pending=limited(async()=>{
      if(fs.existsSync(file)) return read(file);
      const result=await runner.call(messages,'judge',judgeSettings);save(file,result);return result;
    });
    pendingJudgments.set(key,pending);
    try{return await pending;}finally{pendingJudgments.delete(key);}
  };
  let completed=0;
  const tutorJobs=m.tutor_targets.map(ref=>async()=>{
    const old=read(path.join(root,ref.file)),c=old.input;
    const initial=old.target.format_repair?.initial||old.target;
    for(const model of [m.judge_model,m.model]) {
      const dir=path.join(out,'tutor',model),file=path.join(dir,`${c.id}-${old.repetition}.json`);
      if(fs.existsSync(file)){assert.equal(read(file).experiment_fingerprint,fingerprint);continue;}
      const targetFile=path.join(dir,'targets',`${c.id}-${old.repetition}.json`);
      let generated;
      if(model===m.judge_model) generated={target:old.target,calls:[]};
      else if(fs.existsSync(targetFile)) generated=read(targetFile);
      else {
        generated=await limited(()=>runner.generateTarget(initial.request.messages,m.tutor.variant,{...m.tutor.settings,model},undefined,m.tutor.contract_version));
        save(targetFile,generated);
      }
      matchingRequest(generated.target,initial.request,m.judge_model);
      const evaluated=await evaluator.evaluateGeneratedOutput({caseDefinition:c,rawOutput:generated.target.error?'':generated.target.text,
        contractVersion:m.tutor.contract_version,settings:judgeSettings,judgeCall,sha:hash});
      save(file,{experiment_fingerprint:fingerprint,case_id:c.id,repetition:old.repetition,source_type:c.source_type,role:c.role,partitions:c.partitions,input:c,
        target_generation:generated.target.payload?.id||null,target:generated.target,new_target_calls:generated.calls,baseline_source:ref,...evaluated});
    }
    console.log(`Tutor ${++completed}/${m.tutor_targets.length}: ${c.id}/${old.repetition}`);
  });
  const f=m.transfer,target=fixedModel(transfer.loadProduction(m.candidate_transfer_snapshot),m.model);
  const transport=async request=>limited(async()=>{
    assert.equal(request.model,m.model);assert.equal(request.temperature,f.settings.temperature);
    assert.equal(request.max_tokens,f.settings.max_tokens);assert.equal(request.enable_thinking,f.settings.enable_thinking);
    assert.equal(hash(request.messages[0].content),f.prompt_sha256);
    const started_at=new Date().toISOString();
    try {
      const r=await fetch(endpoint+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.OAI_API_KEY},body:JSON.stringify(request),signal:AbortSignal.timeout(f.settings.timeout_ms)});
      const body=await r.text();let response;try{response=JSON.parse(body);}catch{response={unparsed_body:body};}
      return {request,endpoint,started_at,ended_at:new Date().toISOString(),status:r.status,response};
    }catch(e){return {request,endpoint,started_at,ended_at:new Date().toISOString(),error:e.message};}
  });
  const transferDir=path.join(out,'transfer',m.model,'generations');let transferCompleted=0;
  async function execute(c,rep,state,reused) {
    const file=path.join(transferDir,`${c.id}-r${rep}.json`);let g;
    if(fs.existsSync(file)){
      g=read(file);assert.equal(g.experiment_fingerprint,fingerprint);let index=0;
      const reconstructed=await transfer.executeTarget(c,target,async request=>{const call=g.result.calls[index++];assert.deepEqual(call.request,request);return structuredClone(call);},state);
      assert.equal(index,g.result.calls.length);
      for(const key of ['parsed','applied','http_status','prior_state','next_state','applied_event','projected_assessment_due'])assert.equal(hash(reconstructed[key]),hash(g.result[key]),'Saved consumer drift: '+key);
    }
    else {
      let i=0;
      const replay=async request=>{const call=reused.result.calls[i++];assert.deepEqual(call.request,request);return structuredClone(call);};
      const result=await transfer.executeTarget(c,target,reused?replay:transport,state);
      if(reused)assert.equal(i,reused.result.calls.length);
      g={experiment_fingerprint:fingerprint,case_id:c.id,repetition:rep,result,checks:transfer.score(c,result),reused_from:reused?`${reused.case_id}-r${rep}.json`:null};save(file,g);
    }
    const input=structuredClone(c.input);if(state)Object.assign(input.items[0],state);assert.deepEqual(g.result.input,input);
    assert.deepEqual(g.checks,transfer.score(c,g.result));
    console.log(`Transfer ${++transferCompleted}/${f.expected_generations}: ${c.id}/${rep}`);return g;
  }
  const transferJobs=[];
  for(const rep of [1,2,3]) {
    for(const c of f.cases.filter(c=>!c.sequence_id&&!f.aliases[c.id])) transferJobs.push(()=>execute(c,rep,null,null));
    for(const id of new Set(f.cases.map(c=>c.sequence_id).filter(Boolean))) transferJobs.push(async()=>{let state=null;for(const c of f.cases.filter(c=>c.sequence_id===id).sort((a,b)=>a.sequence_step-b.sequence_step)){const g=await execute(c,rep,state,null);state=g.result.next_state;}});
  }
  await pool([...transferJobs,...tutorJobs],workers);
  for(const [id,canonical]of Object.entries(f.aliases))for(const rep of [1,2,3])await execute(f.cases.find(c=>c.id===id),rep,null,read(path.join(transferDir,`${canonical}-r${rep}.json`)));
  return report(out);
}
function report(out) {
  const m=validate(out),result={at:new Date().toISOString(),manifest_sha256:hash(m),tutor:{},transfer:{}};
  const snapshots={},reports={};
  for(const model of [m.judge_model,m.model]) {
    const dir=path.join(out,'tutor',model),rows=m.tutor_targets.map(ref=>read(path.join(dir,`${ref.case_id}-${ref.repetition}.json`)));
    snapshots[model]={...m.tutor,settings:{...m.tutor.settings,model},manifest:m.evaluator_manifest,rubrics:m.rubrics};reports[model]={results:rows};
    // Gate settings equality excludes only the declared target-model factor; actual identities remain in snapshots and raw requests.
    const comparisonSnapshot={...snapshots[model],settings:{...snapshots[model].settings,model:m.judge_model}};
    const gate=assess(reports[model],comparisonSnapshot,model===m.model?reports[m.judge_model]:null,model===m.model?snapshots[m.judge_model]:null);
    result.tutor[model]={...gate,classification:tutorClassification.classify(reports[model],snapshots[model]),analysis:analyze(reports[model],snapshots[model])};save(path.join(out,'tutor',model,`summary-${Date.now()}.json`),result.tutor[model]);
    const f=m.transfer,dir2=model===m.judge_model?path.join(root,m.transfer_reference,'generations'):path.join(out,'transfer',model,'generations');
    const records=f.cases.flatMap(c=>[1,2,3].map(rep=>read(path.join(dir2,`${c.id}-r${rep}.json`))));
    const summary=transfer.summarize(f,records.map(g=>({...g,repetition:g.repetition-1})));summary.classification=classificationReport(f,records);
    summary.target_model=model;result.transfer[model]=summary;
  }
  const before=result.transfer[m.judge_model],after=result.transfer[m.model];
  result.transfer_nonregression=after.rows.map(row=>{const old=before.rows.find(x=>x.group===row.group&&x.metric===row.metric);return {group:row.group,metric:row.metric,baseline:old.passed/old.expected,candidate:row.passed/row.expected,pass:row.passed>=old.passed};});
  result.transfer_classification_nonregression=after.classification.rows.filter(r=>!r.diagnostic).map(row=>{const old=before.classification.rows.find(x=>x.group===row.group&&x.view===row.view);return {group:row.group,view:row.view,baseline:old.macro_f1,candidate:row.macro_f1,pass:row.macro_f1>=old.macro_f1};});
  result.transfer_new_failures=m.transfer.cases.flatMap(c=>[1,2,3].flatMap(rep=>{
    const old=read(path.join(root,m.transfer_reference,'generations',`${c.id}-r${rep}.json`));
    const next=read(path.join(out,'transfer',m.model,'generations',`${c.id}-r${rep}.json`));
    return next.checks.filter(x=>x.status!=='pass'&&old.checks.some(y=>y.metric===x.metric&&y.status==='pass')).map(x=>({case_id:c.id,repetition:rep,...x}));
  }));
  save(path.join(out,`comparison-${Date.now()}.json`),result);
  console.log(JSON.stringify({out,tutor:Object.fromEntries(Object.entries(result.tutor).map(([k,v])=>[k,{verdict:v.verdict,issues:v.issues.length}])),transfer:Object.fromEntries(Object.entries(result.transfer).map(([k,v])=>[k,{rows:v.rows.filter(r=>r.group==='overall'),classification:v.classification.rows.filter(r=>r.group==='overall')}]))}));
  return result;
}
module.exports={fixedModel,modelSnapshot,matchingRequest,limiter,freeze,validate,run,report};
if(require.main===module){const [command,out,...args]=process.argv.slice(2);Promise.resolve().then(()=>command==='freeze'?freeze(path.resolve(out),path.resolve(args[0]),path.resolve(args[1]),args[2]):command==='run'?run(path.resolve(out),Number(args[args.indexOf('--num_workers')+1])):command==='report'?report(path.resolve(out)):Promise.reject(Error('Use freeze OUT TUTOR_REFERENCE TRANSFER_REFERENCE MODEL | run OUT --num_workers N | report OUT'))).catch(e=>{console.error(e.stack);process.exitCode=1;});}
