#!/usr/bin/env node
// Purpose: evaluate frozen full Tutor11 on Qwen3.8 without resampling saved outcomes or changing native gates.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {spawn}=require('node:child_process');
const runner=require('./runner'),evaluator=require('./evaluator');
const {assess}=require('./gate'),classification=require('./classification'),{analyze}=require('./analyze');
const {limiter}=require('./model-comparison');
const root=path.resolve(__dirname,'../../..');
const baselineDir=path.join(root,'output/model-comparison-20261015/paired-04');
const referenceDir=path.join(root,'evals/promptfoo/results/qwen3.5-flash/shortcut-removal-20261015-candidate11-thinking-preflight');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function save(f,x){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});}
const fileRef=f=>({path:path.relative(root,f),sha256:hash(fs.readFileSync(f,'utf8'))});
function validateRequest(target,messages,settings){
  const expected={model:settings.model,messages,temperature:0.3,max_tokens:100,enable_thinking:false,response_format:{type:'json_object'}};
  assert.deepEqual((target.format_repair?.initial||target).request,expected);
  assert.deepEqual(target.request,{...expected,messages:target.format_repair?require('./product-adapter').productionRepair(messages):messages});
}
function freeze(out){
  assert(!fs.existsSync(out),'New run directory required');
  const reference=read(path.join(referenceDir,'snapshot.json')),baseline=read(path.join(baselineDir,'manifest.json'));
  assert.equal(reference.cases.length,61);assert.deepEqual(reference.cases,baseline.tutor.cases);
  assert.equal(reference.variant,'product');assert.equal(reference.contract_version,'v2');
  assert.equal(reference.policy,fs.readFileSync(path.join(root,'evals/promptfoo/refinement-20261014/candidate-policy-11.md'),'utf8'));
  const settings={...baseline.tutor.settings,model:'qwen3.8-flash',request_concurrency:48};
  const judge_settings={...baseline.tutor.settings,model:'qwen3.5-flash'};
  const refs=reference.cases.flatMap(c=>[0,1,2].map(repetition=>{
    const historical=path.join(referenceDir,`${c.id}-${repetition}.json`),old=read(historical),target=(old.target.format_repair?.initial||old.target);
    assert.deepEqual(old.input,c);assert.equal(old.repetition,repetition);assert.equal(old.fingerprint,reference.fingerprint);
    assert.equal(target.request.model,'qwen3.5-flash');assert.equal(target.request.temperature,0.3);assert.equal(target.request.max_tokens,8000);assert.equal(target.request.enable_thinking,true);
    assert.deepEqual(target.request.response_format,{type:'json_object'});
    const baselineFile=path.join(baselineDir,'tutor/qwen3.8-flash',`${c.id}-${repetition}.json`),saved=read(baselineFile);
    assert.deepEqual(saved.input,c);assert.equal(saved.repetition,repetition);validateRequest(saved.target,(saved.target.format_repair?.initial||saved.target).request.messages,settings);
    return {case_id:c.id,repetition,historical:fileRef(historical),baseline:fileRef(baselineFile),messages:target.request.messages};
  }));
  const sourceFiles=[__filename,...['runner.js','evaluator.js','gate.js','classification.js','analyze.js','product-adapter.js','model-comparison.js'].map(f=>path.join(__dirname,f)),
    ...evaluator.manifest.sources.map(s=>path.join(root,s.path)),
    ...['v1','v0'].flatMap(v=>fs.readdirSync(path.join(__dirname,'../rubrics',v)).filter(f=>f.endsWith('.md')||f.endsWith('.js')||f==='manifest.json').map(f=>path.join(__dirname,'../rubrics',v,f)))];
  const changes=reference.dependencies.filter(d=>{const b=baseline.tutor.dependencies.find(x=>x.file===d.file);return !b||hash(d.content)!==hash(b.content)}).map(d=>({file:d.file,candidate_sha256:hash(d.content),baseline_sha256:hash(baseline.tutor.dependencies.find(x=>x.file===d.file).content)}));
  const cache=fs.readdirSync(path.join(baselineDir,'judge-cache')).filter(f=>f.endsWith('.json')).map(f=>{
    const file=path.join(baselineDir,'judge-cache',f),saved=read(file),key=hash({messages:saved.request.messages,settings:judge_settings});
    assert.equal(f,key+'.json');assert.equal(saved.request.model,'qwen3.5-flash');assert.equal(saved.request.temperature,0);assert.equal(saved.request.max_tokens,8000);assert.equal(saved.request.enable_thinking,true);
    return {key,...fileRef(file)};
  });
  const manifest={created_at:new Date().toISOString(),reference,baseline_snapshot:baseline.tutor,settings,judge_settings,
    changed_factors:['Full historical Tutor11 policy instead of frozen Tutor07 policy','Three historical Guard-scope base dependency changes','Target Qwen3.8 Flash, nonthinking100tokens instead of historical11 thinking8000tokens','Operational48call concurrency; comparator metadata normalizes operational concurrency only'],
    baseline_scope:'Reuse all183 frozen Tutor07 Qwen3.8 targets and completed current-evaluator judgments; excludes later deployed Guard addition.',
    holdout_status:'All61cases exposed regression/development; independent unseen validation remains separate and pending.',
    dependency_changes:changes,reference_snapshot:fileRef(path.join(referenceDir,'snapshot.json')),baseline_manifest:fileRef(path.join(baselineDir,'manifest.json')),baseline_final:fileRef(path.join(baselineDir,'final-results.json')),
    records:refs,judge_cache:cache,evaluator_manifest:evaluator.manifest,rubrics:Object.fromEntries(reference.cases.map(c=>[c.id,evaluator.rubricsFor(c)])),
    sources:[...new Set(sourceFiles)].map(f=>({...fileRef(f),content:fs.readFileSync(f,'utf8')}))};
  save(path.join(out,'manifest.json'),manifest);
  console.log(JSON.stringify({out,manifest_sha256:hash(manifest),driver_sha256:hash(fs.readFileSync(__filename,'utf8')),records:refs.length,cache:cache.length,dependency_changes:changes}));
  return manifest;
}
function validate(out){const m=read(path.join(out,'manifest.json'));for(const ref of [...m.sources,m.reference_snapshot,m.baseline_manifest,m.baseline_final,...m.records.flatMap(r=>[r.historical,r.baseline]),...m.judge_cache])assert.equal(hash(fs.readFileSync(path.join(root,ref.path),'utf8')),ref.sha256,'Source drift: '+ref.path);return m;}
async function monitor(out){
  const code=`const fs=require('node:fs'),os=require('node:os'),{execFile}=require('node:child_process');function tick(){execFile('df',['-k',process.cwd()],(error,stdout)=>{try{fs.appendFileSync(process.argv[1],JSON.stringify({at:new Date().toISOString(),free_memory:os.freemem(),load:os.loadavg(),disk:stdout,error:error?.message})+'\\n');}catch(e){process.stderr.write(e.message+'\\n');}if(process.send)process.send('ready');});}tick();setInterval(tick,30000);`;
  const child=spawn(process.execPath,['-e',code,path.join(out,'resource-monitor.jsonl')],{cwd:root,stdio:['ignore','inherit','inherit','ipc']});
  await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('Monitor exited '+c)));});return child;
}
async function run(out,workers){
  assert(Number.isInteger(workers)&&workers>=1&&workers<=48,'num_workers must be1–48');
  const m=validate(out),fingerprint=hash(m),limited=limiter(workers),judgePending=new Map(),cache=new Map(m.judge_cache.map(r=>[r.key,r]));
  const env={...require(path.join(root,'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'tutor-system/.env'))),...process.env};
  assert(env.OAI_API_KEY&&env.OAI_BASE_URL,'Configured provider required');assert.equal(env.OAI_MODEL,m.settings.model,'Matching OAI_MODEL required');
  save(path.join(out,`session-${Date.now()}.json`),{started_at:new Date().toISOString(),command:process.argv,num_workers:workers,fingerprint,endpoint:env.OAI_BASE_URL});
  const resource=await monitor(out);
  async function judgeCall(messages){
    const key=hash({messages,settings:m.judge_settings}),file=path.join(out,'judge-cache',key+'.json');
    if(fs.existsSync(file))return read(file).result;
    if(judgePending.has(key))return judgePending.get(key);
    const pending=(async()=>{const reused=cache.get(key);const result=reused?read(path.join(root,reused.path)):await limited(()=>runner.call(messages,'judge',m.judge_settings));
      assert.deepEqual(result.request,{model:'qwen3.5-flash',messages,temperature:0,max_tokens:8000,enable_thinking:true,response_format:{type:'json_object'}});
      save(file,{key,reused_from:reused||null,result});return result;})();
    judgePending.set(key,pending);try{return await pending;}finally{judgePending.delete(key);}
  }
  let cursor=0,completed=0;
  try{await Promise.all(Array.from({length:workers},async()=>{while(cursor<m.records.length){const ref=m.records[cursor++],c=m.reference.cases.find(x=>x.id===ref.case_id),file=path.join(out,'records',`${c.id}-${ref.repetition}.json`);
    if(fs.existsSync(file)){assert.equal(read(file).experiment_fingerprint,fingerprint);completed++;continue;}
    const targetFile=path.join(out,'targets',`${c.id}-${ref.repetition}.json`);
    let generated;if(fs.existsSync(targetFile))generated=read(targetFile);else{generated=await limited(()=>runner.generateTarget(ref.messages,m.reference.variant,{...m.settings,request_concurrency:workers},undefined,m.reference.contract_version));validateRequest(generated.target,ref.messages,m.settings);save(targetFile,generated);}
    validateRequest(generated.target,ref.messages,m.settings);
    const evaluated=await evaluator.evaluateGeneratedOutput({caseDefinition:c,rawOutput:generated.target.error?'':generated.target.text,contractVersion:m.reference.contract_version,settings:m.judge_settings,judgeCall,sha:hash});
    save(file,{experiment_fingerprint:fingerprint,case_id:c.id,repetition:ref.repetition,source_type:c.source_type,role:c.role,partitions:c.partitions,input:c,target_generation:generated.target.payload?.id||null,target:generated.target,new_target_calls:generated.calls,reference:ref,...evaluated});
    console.log(`Tutor11 ${++completed}/${m.records.length}: ${c.id}/${ref.repetition}`);
  }}));return report(out);}finally{resource.kill();}
}
function report(out){
  const finalFile=path.join(out,'final-results.json'),completedAt=fs.existsSync(finalFile)?read(finalFile).completed_at:new Date().toISOString();
  const m=validate(out),rows=m.records.map(r=>read(path.join(out,'records',`${r.case_id}-${r.repetition}.json`))),baselineRows=m.records.map(r=>read(path.join(root,r.baseline.path)));
  const comparisonSettings={...m.baseline_snapshot.settings,model:'qwen3.8-flash'},snapshot={...m.reference,settings:comparisonSettings,manifest:m.evaluator_manifest,rubrics:m.rubrics},baselineSnapshot={...m.baseline_snapshot,settings:comparisonSettings,manifest:m.evaluator_manifest,rubrics:m.rubrics};
  const targetReport={results:rows},baselineReport={results:baselineRows};
  const gate=assess(targetReport,snapshot,baselineReport,baselineSnapshot),nativeClassification=classification.classify(targetReport,snapshot),baselineClassification=classification.classify(baselineReport,baselineSnapshot),compared=classification.compare(nativeClassification,baselineClassification);
  const result={completed_at:completedAt,manifest_sha256:hash(m),target:'Full Tutor11/Qwen3.8 nonthinking',baseline:'Frozen Tutor07/Qwen3.8 nonthinking',gate,classification:compared,baseline_gate:assess(baselineReport,baselineSnapshot),baseline_classification:baselineClassification,analysis:analyze(targetReport,snapshot),baseline_analysis:analyze(baselineReport,baselineSnapshot),
    benchmark_verdict:gate.verdict==='accepted'&&compared.verdict==='accepted'?'passed_exposed_suite':'failed',unseen_validation:'pending; no sealed content opened',release_verdict:'not evaluated by this driver',
    comparison_normalization:'Both comparison snapshots carry baseline decoding metadata with actual3.8model. Only request_concurrency48versus24 is normalized; actual requests retain true settings. Prompt/base dependency differences remain declared experimental factors.'};
  const reportFile=path.join(out,'report.json');if(!fs.existsSync(reportFile))save(reportFile,{fingerprint:hash(m),results:rows});
  if(!fs.existsSync(finalFile))save(finalFile,result);else assert.deepEqual(read(finalFile),result,'Do not overwrite completed report');
  console.log(JSON.stringify({out,benchmark_verdict:result.benchmark_verdict,issues:gate.issues,classification_regressions:compared.regressions,classification_failures:compared.rows.filter(r=>r.gating&&r.verdict!=='pass')}));return result;
}
module.exports={freeze,validate,validateRequest,run,report};
if(require.main===module){const [command,out,...args]=process.argv.slice(2);Promise.resolve().then(()=>command==='freeze'?freeze(path.resolve(out)):command==='run'?run(path.resolve(out),Number(args[args.indexOf('--num_workers')+1])):command==='report'?report(path.resolve(out)):Promise.reject(Error('Use freeze OUT | run OUT --num_workers N | report OUT'))).catch(e=>{console.error(e.stack);process.exitCode=1;});}
