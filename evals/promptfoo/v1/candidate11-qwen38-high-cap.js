#!/usr/bin/env node
// Purpose: evaluate a separate600token full Tutor11 condition while preserving the completed100token experiment.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const runner=require('./runner'),evaluator=require('./evaluator'),{assess}=require('./gate'),classification=require('./classification'),{analyze}=require('./analyze'),{limiter}=require('./model-comparison');
const root=path.resolve(__dirname,'../../..'),reference=path.join(root,'output/candidate11-qwen38-20261015/full-02');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const ref=f=>({path:path.relative(root,f),sha256:hash(fs.readFileSync(f,'utf8'))});
function save(f,x){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});}
function judgeRequest(messages){return {model:'qwen3.5-flash',messages,temperature:0,max_tokens:8000,enable_thinking:true,response_format:{type:'json_object'}};}
function actualKey(request){assert.deepEqual(request,judgeRequest(request.messages));return hash(request);}
function validateTarget(target,messages){const request={model:'qwen3.8-flash',messages,temperature:0.3,max_tokens:600,enable_thinking:false,response_format:{type:'json_object'}};assert.deepEqual((target.format_repair?.initial||target).request,request);assert.deepEqual(target.request,{...request,messages:target.format_repair?require('./product-adapter').productionRepair(messages):messages});}
function comparisonSettings(settings,baseline){
  const normalized={...settings,target_max_tokens:baseline.target_max_tokens,request_concurrency:baseline.request_concurrency};
  assert.equal(settings.target_max_tokens,600);assert.equal(baseline.target_max_tokens,100);assert.deepEqual(normalized,baseline,'Undeclared settings drift');return normalized;
}
function freeze(out){
  assert(!fs.existsSync(out),'New condition directory required');
  const prior=require('./candidate11-qwen38').validate(reference),completed=read(path.join(reference,'final-results.json'));
  assert.equal(completed.benchmark_verdict,'failed');
  const settings={...prior.settings,target_max_tokens:600},baselineSettings={...prior.baseline_snapshot.settings,model:'qwen3.8-flash'};comparisonSettings(settings,baselineSettings);
  const cache=[];
  // Source rank and lexical path select uniformly, including failed judgments and transport errors.
  for(const [rank,dir,wrapped]of [[0,path.join(root,'output/model-comparison-20261015/paired-04/judge-cache'),false],[1,path.join(reference,'judge-cache'),true]])for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
    const file=path.join(dir,f),saved=read(file),result=wrapped?saved.result:saved;cache.push({...ref(file),rank,wrapped,key:actualKey(result.request)});
  }
  const groups=new Map();for(const item of cache){if(!groups.has(item.key))groups.set(item.key,[]);groups.get(item.key).push(item);}
  const selected=[...groups].map(([key,sources])=>({key,selected:sources[0],duplicates:sources.slice(1)}));
  const manifest={...prior,created_at:new Date().toISOString(),condition:'Full historical Tutor11/Qwen3.8/nonthinking600',settings,
    changed_factors:['Full Tutor11 policy and three historical Guard-scope base changes versus frozen Tutor07','Target max_tokens600 versus reused Tutor07/Qwen3.8 max_tokens100; bothtemperature0.3/thinkingfalse','Operational concurrency48versus24; no model/format/judge/case/rubric/threshold changes'],
    baseline_scope:'Explicit whole-configuration comparison against completed07/Qwen3.8/100; does not isolate prompt or token-budget effect.',
    prior_condition:{manifest:ref(path.join(reference,'manifest.json')),final_results:ref(path.join(reference,'final-results.json')),verdict:completed.benchmark_verdict},
    cache_selection:'Rank0paired04 before rank1full02, then lexical filename; first source chosen independent of outcome. Every duplicate source hash retained.',
    judge_cache:cache,judge_cache_selected:selected,comparison_normalization:{target_max_tokens:{actual_candidate:600,baseline:100},request_concurrency:{actual_candidate:48,baseline:24}},
    sources:[...prior.sources,{...ref(__filename),content:fs.readFileSync(__filename,'utf8')}]};
  save(path.join(out,'manifest.json'),manifest);
  save(path.join(out,'snapshot.json'),{...prior.reference,settings,manifest:prior.evaluator_manifest,rubrics:prior.rubrics,experiment_fingerprint:hash(manifest)});
  console.log(JSON.stringify({out,manifest_sha256:hash(manifest),driver_sha256:hash(fs.readFileSync(__filename,'utf8')),records:manifest.records.length,cache_sources:cache.length,unique_cache_requests:selected.length}));return manifest;
}
function validate(out){const m=read(path.join(out,'manifest.json'));for(const r of [...m.sources,m.reference_snapshot,m.baseline_manifest,m.baseline_final,m.prior_condition.manifest,m.prior_condition.final_results,...m.records.flatMap(x=>[x.historical,x.baseline]),...m.judge_cache])assert.equal(hash(fs.readFileSync(path.join(root,r.path),'utf8')),r.sha256,'Source drift:'+r.path);comparisonSettings(m.settings,{...m.baseline_snapshot.settings,model:'qwen3.8-flash'});return m;}
function freeDiskKiB(){const lines=execFileSync('df',['-k',root],{encoding:'utf8'}).trim().split('\n');return Number(lines.at(-1).trim().split(/\s+/)[3]);}
async function monitor(out){
  const script=`const fs=require('node:fs'),os=require('node:os'),{execFile}=require('node:child_process');function tick(){execFile('df',['-k',process.cwd()],(error,disk)=>{try{fs.appendFileSync(process.argv[1],JSON.stringify({at:new Date().toISOString(),disk,free_memory:os.freemem(),load:os.loadavg(),error:error?.message})+'\\n');}catch(e){process.stderr.write(e.message+'\\n');}if(process.send)process.send('ready');});}tick();setInterval(tick,30000);`;
  const child=spawn(process.execPath,['-e',script,path.join(out,'resource-monitor.jsonl')],{cwd:root,stdio:['ignore','inherit','inherit','ipc']});await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',x=>reject(Error('Monitor exited '+x)));});return child;
}
async function run(out,workers){
  assert(Number.isInteger(workers)&&workers>=1&&workers<=48,'num_workers must be1–48');assert(freeDiskKiB()>=512*1024,'At least512MiB free disk required before provider calls');
  const m=validate(out),fingerprint=hash(m),limited=limiter(workers),pending=new Map(),cache=new Map(m.judge_cache_selected.map(r=>[r.key,r.selected]));
  const env={...require(path.join(root,'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'tutor-system/.env'))),...process.env};assert(env.OAI_API_KEY&&env.OAI_BASE_URL);assert.equal(env.OAI_MODEL,m.settings.model);
  save(path.join(out,`session-${Date.now()}.json`),{started_at:new Date().toISOString(),command:process.argv,num_workers:workers,fingerprint,endpoint:env.OAI_BASE_URL,free_disk_kib:freeDiskKiB()});
  const resource=await monitor(out);
  async function judgeCall(messages){const request=judgeRequest(messages),key=actualKey(request),file=path.join(out,'judge-cache',key+'.json');
    if(fs.existsSync(file))return read(file).result;if(pending.has(key))return pending.get(key);
    const work=(async()=>{const source=cache.get(key),saved=source?read(path.join(root,source.path)):null,result=source?(source.wrapped?saved.result:saved):await limited(()=>runner.call(messages,'judge',m.judge_settings));assert.deepEqual(result.request,request);save(file,{key,reused_from:source||null,result});return result;})();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
  }
  let cursor=0,completed=0;
  try{await Promise.all(Array.from({length:workers},async()=>{while(cursor<m.records.length){const r=m.records[cursor++],c=m.reference.cases.find(x=>x.id===r.case_id),file=path.join(out,'records',`${c.id}-${r.repetition}.json`);
    if(fs.existsSync(file)){assert.equal(read(file).experiment_fingerprint,fingerprint);completed++;continue;}
    const targetFile=path.join(out,'targets',`${c.id}-${r.repetition}.json`);let generated;
    if(fs.existsSync(targetFile))generated=read(targetFile);else{generated=await limited(()=>runner.generateTarget(r.messages,m.reference.variant,{...m.settings,request_concurrency:workers},undefined,m.reference.contract_version));validateTarget(generated.target,r.messages);save(targetFile,generated);}validateTarget(generated.target,r.messages);
    const evaluated=await evaluator.evaluateGeneratedOutput({caseDefinition:c,rawOutput:generated.target.error?'':generated.target.text,contractVersion:m.reference.contract_version,settings:m.judge_settings,judgeCall,sha:hash});
    save(file,{experiment_fingerprint:fingerprint,case_id:c.id,repetition:r.repetition,source_type:c.source_type,role:c.role,partitions:c.partitions,input:c,target_generation:generated.target.payload?.id||null,target:generated.target,new_target_calls:generated.calls,reference:r,...evaluated});console.log(`Tutor11/600 ${++completed}/${m.records.length}: ${c.id}/${r.repetition}`);
  }}));return report(out);}finally{resource.kill();}
}
function report(out){
  const m=validate(out),file=path.join(out,'final-results.json'),completedAt=fs.existsSync(file)?read(file).completed_at:new Date().toISOString(),rows=m.records.map(r=>read(path.join(out,'records',`${r.case_id}-${r.repetition}.json`))),baselineRows=m.records.map(r=>read(path.join(root,r.baseline.path)));
  const baselineSettings={...m.baseline_snapshot.settings,model:'qwen3.8-flash'},normalized=comparisonSettings(m.settings,baselineSettings),snapshot={...m.reference,settings:normalized,manifest:m.evaluator_manifest,rubrics:m.rubrics},baselineSnapshot={...m.baseline_snapshot,settings:baselineSettings,manifest:m.evaluator_manifest,rubrics:m.rubrics};
  const candidate={results:rows},baseline={results:baselineRows},gate=assess(candidate,snapshot,baseline,baselineSnapshot),classes=classification.compare(classification.classify(candidate,snapshot),classification.classify(baseline,baselineSnapshot));
  const result={completed_at:completedAt,manifest_sha256:hash(m),condition:m.condition,actual_candidate_settings:m.settings,actual_baseline_settings:baselineSettings,comparison_normalization:m.comparison_normalization,gate,classification:classes,baseline_gate:assess(baseline,baselineSnapshot),baseline_classification:classification.classify(baseline,baselineSnapshot),analysis:analyze(candidate,snapshot),baseline_analysis:analyze(baseline,baselineSnapshot),benchmark_verdict:gate.verdict==='accepted'&&classes.verdict==='accepted'?'passed_exposed_suite':'failed',unseen_validation:'pending; sealed content unopened',release_verdict:'not evaluated by this driver'};
  const rawReport=path.join(out,'report.json');if(!fs.existsSync(rawReport))save(rawReport,{fingerprint:hash(m),results:rows});if(!fs.existsSync(file))save(file,result);else assert.deepEqual(read(file),result);
  console.log(JSON.stringify({out,benchmark_verdict:result.benchmark_verdict,gate_issues:gate.issues.length,classification_verdict:classes.verdict,classification_regressions:classes.regressions.length}));return result;
}
module.exports={actualKey,judgeRequest,validateTarget,comparisonSettings,freeze,validate,freeDiskKiB,run,report};
if(require.main===module){const [command,out,...args]=process.argv.slice(2);Promise.resolve().then(()=>command==='freeze'?freeze(path.resolve(out)):command==='run'?run(path.resolve(out),Number(args[args.indexOf('--num_workers')+1])):command==='report'?report(path.resolve(out)):Promise.reject(Error('Use freeze OUT | run OUT --num_workers N | report OUT'))).catch(e=>{console.error(e.stack);process.exitCode=1;});}
