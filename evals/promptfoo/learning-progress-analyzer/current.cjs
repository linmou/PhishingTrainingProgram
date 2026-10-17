#!/usr/bin/env node
// Purpose: evaluate added branch cases against the learning-progress analyzer, preserving resumable evidence and full-suite coverage.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {loadProduction,buildCases,buildRevisionCases,executeTarget,score,summarize} = require('./evaluate.cjs');
const {classificationReport} = require('./classification.cjs');
const root = path.resolve(__dirname, '../../..');
const archive = path.join(root, 'output/transfer-analysis-eval-20261013');
const sourceCommit = 'af86353863c60d5517b6bb6b3a4748554c64fd36';
const sources = ['negative-cases.json','surface-cases.json','negative-holdouts-v2.json'];
const codeFiles = ['current.cjs','evaluate.cjs','classification.cjs'];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const save = (file,value) => { fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'}); };

function addedCases() {
  const learner='11111111-1111-4111-8111-111111111111', room='22222222-2222-4222-8222-222222222222';
  const focus='33333333-3333-4333-8333-333333333333', item='44444444-4444-4444-8444-444444444444';
  const other='55555555-5555-4555-8555-555555555555', tutor='66666666-6666-4666-8666-666666666666';
  return sources.flatMap(file => {
    const content=fs.readFileSync(path.join(__dirname,file),'utf8'), data=JSON.parse(content);
    return data.cases.map(c => {
      const message={id:focus,room_id:room,user_id:learner,user_role:'student',content:c.learner};
      const history=c.history.map((h,i)=>({id:`history-${i}`,source:h.speaker==='setup'?'room_setup':'message',user_id:h.speaker==='other'?other:h.role==='student'?learner:h.role==='tutor'?tutor:null,user_role:h.role,speaker_name:h.speaker==='setup'?'Scenario participant':null,content:h.content}));
      return {...c,id:`af86353_${c.id}`,version:3,suite:file.replace('.json',''),pair_id:c.pair_id?`af86353_${c.pair_id}`:null,
        requirements:c.requirements.filter(r=>r!=='TA05'),expected:{kind:c.expected.kind},classification_applicable:true,
        input:{focus_student_id:learner,evidence_message_id:focus,message,items:[{id:item,priority:'important',...c.target}],dialogue_history:[...history,{...message,source:'message',speaker_name:null}]},
        provenance:{source_commit:sourceCommit,source_file:file,source_sha256:hash(content),original_id:c.id,original_expected:c.expected,original_requirements:c.requirements,author:data.author||'branch authors',holdout_eligible:false,exposure:'Previously exposed branch regression; original gold event unchanged',identity_policy:'Shared synthetic identities; no case or expected label in target request',label_review:'human review pending'}};
    });
  });
}

function suiteCases(coverage) {
  if (!['added','full'].includes(coverage)) throw new Error('coverage must be added or full');
  const added=addedCases();
  if(coverage==='added') return {cases:added,original_case_ids:[]};
  const retained=buildRevisionCases(buildCases(read(path.join(archive,'production-export.json')),read(path.join(__dirname,'development.json')),read(path.join(__dirname,'holdouts.json'))));
  const fixed=retained.map(c=>({...c,sequence_id:null,classification_applicable:true}));
  const sequences=retained.filter(c=>c.sequence_id).map(c=>({...c,id:`propagated_${c.id}`,suite:'sequence_replay',classification_applicable:false}));
  return {cases:[...fixed,...added,...sequences],original_case_ids:retained.map(c=>c.id)};
}

function aliasesFor(cases) {
  const seen=new Map(), aliases={};
  for(const c of cases) {
    if(c.sequence_id) continue;
    const key=hash({input:c.input,expected:c.expected});
    if(seen.has(key)) aliases[c.id]=seen.get(key); else seen.set(key,c.id);
  }
  return aliases;
}

function validateManifest(frozen) {
  const ids=frozen.cases.map(c=>c.id);
  if(!ids.length||new Set(ids).size!==ids.length) throw new Error('Cases must be nonempty and unique');
  if(frozen.settings.repetitions!==3||frozen.expected_generations!==ids.length*3) throw new Error('Invalid repetition coverage');
  if(JSON.stringify(frozen.aliases)!==JSON.stringify(aliasesFor(frozen.cases))) throw new Error('Alias/input drift');
  if(frozen.expected_provider_calls!==(ids.length-Object.keys(frozen.aliases).length)*3) throw new Error('Invalid provider coverage');
  for(const artifact of frozen.artifacts) if(hash(artifact.content)!==artifact.sha256) throw new Error('Corrupt frozen artifact '+artifact.path);
  for(const file of frozen.snapshot.files) if(hash(file.content)!==file.sha256) throw new Error('Corrupt frozen target '+file.name);
  if(hash(loadProduction(frozen.snapshot).evaluationPrompt)!==frozen.prompt_sha256) throw new Error('Prompt identity mismatch');
  for(const file of codeFiles) {
    const artifact=frozen.artifacts.find(a=>a.path===path.relative(root,path.join(__dirname,file)));
    if(!artifact||hash(fs.readFileSync(path.join(__dirname,file),'utf8'))!==artifact.sha256) throw new Error('Runner/scorer drift: '+file);
  }
}

function freeze(dir,coverage) {
  if(fs.existsSync(dir)) throw new Error('Freeze requires a new directory');
  const snapshot=read(path.join(archive,'production-edge.json'));
  snapshot.files=snapshot.files.map(f=>{const content=fs.readFileSync(path.join(root,'tutor-system',f.name),'utf8');return {...f,content,sha256:hash(content)};});
  const {cases,original_case_ids}=suiteCases(coverage), aliases=aliasesFor(cases);
  const files=[...codeFiles,...sources,'development.json','holdouts.json','final-assessment-cases.json','final-assessment-holdouts.json','final-assessment-refinement-holdouts.json','final-assessment-refinement-holdouts-v2.json'].map(f=>path.relative(root,path.join(__dirname,f)));
  files.push(...['constitution.md','tutor-behavior-specification.md','transfer-status-response-contract.md','learning-progress-analyzer-evaluation-plan.md'].map(f=>'tutor-system/docs/ai-behaviors/'+f));
  const prompt=loadProduction(snapshot).evaluationPrompt;
  const frozen={run_id:path.basename(dir),frozen_at:new Date().toISOString(),coverage,source_commit:sourceCommit,
    git_revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    git_status:execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}),
    comparison:'Learning-progress analyzer shared by original tutor and cleaned tutor candidates; no tutor-prompt factor enters these calls. Historical analyzer prompts remain separately reported.',
    grounding:'Adopted constitution 1.0; TA01–TA04 and T09.1 current contract; human gold-label review pending',
    cases,original_case_ids,aliases,snapshot,prompt,prompt_sha256:hash(prompt),
    settings:{model:'qwen3.5-flash',temperature:0,max_tokens:600,enable_thinking:false,response_format:{type:'json_object'},repetitions:3,seed:null,timeout_ms:90000,target_attempts:1,num_workers:16},
    classification_protocol:{id:'current-transfer-three-repetition-v1',primary:'macro_f1',individual_minimum:0.7,ensemble_minimum:0.9,no_event_recall_minimum:0.9,members:[1,2,3],ties:'abstain',ensemble_2:'diagnostic',averaging:'supported reference classes; zero denominators produce zero',aliases:'Exact same input and gold reuse each corresponding repetition; aliases are dependent coverage, not independent samples'},
    metrics:['raw_event','applied_state','assessment_route','validity'],thresholds:{raw_event:0.8,applied_state:0.8,assessment_route:0.8,validity:1},
    required_suites:[...new Set(cases.map(c=>c.suite))],required_partitions:[...new Set(cases.map(c=>c.partition))],
    expected_generations:cases.length*3,expected_provider_calls:(cases.length-Object.keys(aliases).length)*3,
    artifacts:files.map(file=>{const content=fs.readFileSync(path.join(root,file),'utf8');return {path:file,content,sha256:hash(content)};})};
  validateManifest(frozen);
  save(path.join(dir,'frozen.json'),frozen);
  save(path.join(dir,'freeze-command.json'),{command:process.argv,at:new Date().toISOString(),exit_code:0,frozen_sha256:hash(frozen)});
  console.log(JSON.stringify({dir,coverage,cases:cases.length,calls:frozen.expected_provider_calls,aliases,prompt_sha256:frozen.prompt_sha256}));
  return frozen;
}

function validateGeneration(frozen,c,rep,g,state=null) {
  const input=structuredClone(c.input); if(state) Object.assign(input.items[0],state);
  if(g.frozen_sha256!==hash(frozen)||g.case_id!==c.id||g.repetition!==rep||hash(g.result.input)!==hash(input)||hash(g.checks)!==hash(score(c,g.result))) throw new Error('Saved generation identity/score drift '+c.id+'/'+rep);
  if(g.reused_from!==(frozen.aliases[c.id]?`${frozen.aliases[c.id]}-r${rep}.json`:null)) throw new Error('Saved alias drift');
}

async function generations(dir,frozen) {
  const folder=path.join(dir,'generations');
  const rows=fs.existsSync(folder)?fs.readdirSync(folder).filter(f=>f.endsWith('.json')).map(f=>read(path.join(folder,f))):[];
  const seen=new Set();
  const target=loadProduction(frozen.snapshot);
  for(const g of rows) {
    const key=g.case_id+'/'+g.repetition,c=frozen.cases.find(c=>c.id===g.case_id);
    if(!c||![1,2,3].includes(g.repetition)||seen.has(key)) throw new Error('Unexpected/duplicate generation '+key);
    seen.add(key);
    let state=null;
    if(c.sequence_id&&c.sequence_step>0) {
      const prior=frozen.cases.find(p=>p.sequence_id===c.sequence_id&&p.sequence_step===c.sequence_step-1);
      const previous=rows.find(p=>p.case_id===prior.id&&p.repetition===g.repetition);
      if(!previous) throw new Error('Missing sequence predecessor');
      state=previous.result.next_state;
    }
    validateGeneration(frozen,c,g.repetition,g,state);
    let index=0, requestDrift=false;
    const replay=async request=>{
      const call=g.result.calls[index++];
      if(!call||hash(call.request)!==hash(request)) {requestDrift=true;throw new Error('Saved request drift '+key);}
      return structuredClone(call);
    };
    const reconstructed=await executeTarget(c,target,replay,state);
    if(requestDrift) throw new Error('Saved request drift '+key);
    if(index!==g.result.calls.length) throw new Error('Saved call coverage drift '+key);
    for(const field of ['parsed','applied','http_status','prior_state','next_state','applied_event','projected_assessment_due']) {
      if(hash(reconstructed[field])!==hash(g.result[field])) throw new Error('Saved consumer drift '+key+'/'+field);
    }
    if(g.reused_from) {
      const canonical=rows.find(r=>r.case_id===frozen.aliases[c.id]&&r.repetition===g.repetition);
      if(!canonical||hash(canonical.result.calls)!==hash(g.result.calls)) throw new Error('Saved alias linkage drift '+key);
    }
  }
  return rows;
}

async function report(dir) {
  const frozen=read(path.join(dir,'frozen.json'));validateManifest(frozen);
  const rows=await generations(dir,frozen);
  const result=summarize(frozen,rows.map(g=>({...g,repetition:g.repetition-1})));
  result.classification=classificationReport(frozen,rows);
  result.classification.observations={logical_cases:frozen.cases.filter(c=>c.classification_applicable!==false).length,unique_inputs:frozen.cases.filter(c=>c.classification_applicable!==false&&!frozen.aliases[c.id]).length,dependent_aliases:frozen.aliases};
  result.unique_input_classification_diagnostic=classificationReport({...frozen,cases:frozen.cases.filter(c=>!frozen.aliases[c.id])},rows.filter(g=>!g.reused_from));
  result.actual_provider_calls=rows.filter(g=>!g.reused_from).reduce((n,g)=>n+g.result.calls.length,0);
  result.usage=rows.filter(g=>!g.reused_from).flatMap(g=>g.result.calls).reduce((n,c)=>({prompt_tokens:n.prompt_tokens+(c.response?.usage?.prompt_tokens||0),completion_tokens:n.completion_tokens+(c.response?.usage?.completion_tokens||0)}),{prompt_tokens:0,completion_tokens:0});
  result.aliases=frozen.aliases;
  result.complete=rows.length===frozen.expected_generations&&result.actual_provider_calls===frozen.expected_provider_calls;
  result.verdict=!result.complete?'incomplete':result.classification.benchmark_pass?result.verdict:'failed';
  const file=path.join(dir,`summary-${Date.now()}.json`);save(file,result);
  console.log(JSON.stringify({summary:file,verdict:result.verdict,complete:result.complete,records:rows.length,provider_calls:result.actual_provider_calls,overall:result.rows.filter(r=>r.group==='overall'),classification:result.classification.rows.filter(r=>r.group==='overall').map(({view,macro_f1,verdict})=>({view,macro_f1,verdict}))}));
  return result;
}

async function run(dir,numWorkers) {
  if(!Number.isInteger(numWorkers)||numWorkers<1||numWorkers>16) throw new Error('num_workers must be 1–16');
  const frozen=read(path.join(dir,'frozen.json'));validateManifest(frozen);await generations(dir,frozen);
  const dotenv=require(path.join(root,'tutor-system/node_modules/dotenv'));
  const env={...dotenv.parse(fs.readFileSync(path.join(root,'tutor-system/.env'))),...process.env};
  if(!env.OAI_API_KEY||!env.OAI_BASE_URL||env.OAI_MODEL!==frozen.settings.model) throw new Error('Configured OAI_API_KEY, OAI_BASE_URL and matching OAI_MODEL required');
  const endpoint=env.OAI_BASE_URL.replace(/\/$/,'');
  const session={command:process.argv,started_at:new Date().toISOString(),endpoint,credential_env:'OAI_API_KEY',num_workers:numWorkers,frozen_sha256:hash(frozen)};
  save(path.join(dir,`session-start-${Date.now()}.json`),session);
  const target=loadProduction(frozen.snapshot);
  const transport=async request=>{
    const s=frozen.settings;
    if(request.model!==s.model||request.temperature!==s.temperature||request.max_tokens!==s.max_tokens||request.enable_thinking!==s.enable_thinking||hash(request.response_format)!==hash(s.response_format)||hash(request.messages[0].content)!==frozen.prompt_sha256) throw new Error('Frozen target request drift');
    const started_at=new Date().toISOString();
    try {
      const response=await fetch(endpoint+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.OAI_API_KEY},body:JSON.stringify(request),signal:AbortSignal.timeout(s.timeout_ms)});
      const body=await response.text();let payload;try{payload=JSON.parse(body);}catch{payload={unparsed_body:body};}
      return {request,endpoint,started_at,ended_at:new Date().toISOString(),status:response.status,response:payload};
    }catch(error){return {request,endpoint,started_at,ended_at:new Date().toISOString(),error:error.message};}
  };
  let completed=0;
  async function execute(c,rep,state=null,reused=null) {
    const file=path.join(dir,'generations',`${c.id}-r${rep}.json`);let g;
    if(fs.existsSync(file)){g=read(file);validateGeneration(frozen,c,rep,g,state);}
    else {
      let index=0;
      const replay=async request=>{const call=reused.result.calls[index++];if(!call||hash(call.request)!==hash(request))throw new Error('Alias request mismatch');return structuredClone(call);};
      const result=await executeTarget(c,target,reused?replay:transport,state);
      if(reused&&index!==reused.result.calls.length) throw new Error('Alias call coverage mismatch');
      g={case_id:c.id,version:c.version,suite:c.suite,partition:c.partition,repetition:rep,generation_id:`${frozen.run_id}/${c.id}/r${rep}`,frozen_sha256:hash(frozen),timestamp:new Date().toISOString(),reused_from:reused?`${reused.case_id}-r${rep}.json`:null,result,checks:score(c,result)};
      save(file,g);
    }
    completed++;console.log(`[${completed}/${frozen.expected_generations}] ${c.id} r${rep}: ${g.checks.filter(c=>c.status!=='pass').map(c=>c.metric+':'+c.status).join(', ')||'pass'}${g.reused_from?' (reused)':''}`);return g;
  }
  const jobs=[];
  for(const rep of [1,2,3]) {
    for(const c of frozen.cases.filter(c=>!c.sequence_id&&!frozen.aliases[c.id])) jobs.push({rep,cases:[c]});
    for(const id of new Set(frozen.cases.map(c=>c.sequence_id).filter(Boolean))) jobs.push({rep,cases:frozen.cases.filter(c=>c.sequence_id===id).sort((a,b)=>a.sequence_step-b.sequence_step)});
  }
  let cursor=0;
  await Promise.all(Array.from({length:numWorkers},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];let state=null;for(const c of job.cases){const g=await execute(c,job.rep,state);if(c.sequence_id)state=g.result.next_state;}}}));
  for(const [id,canonical] of Object.entries(frozen.aliases)) for(const rep of [1,2,3]) await execute(frozen.cases.find(c=>c.id===id),rep,null,read(path.join(dir,'generations',`${canonical}-r${rep}.json`)));
  save(path.join(dir,`session-end-${Date.now()}.json`),{...session,ended_at:new Date().toISOString(),exit_code:0});
  return report(dir);
}

module.exports={addedCases,suiteCases,aliasesFor,validateManifest,validateGeneration,generations,freeze,run,report,hash};
if(require.main===module){
  const [command,dir,...args]=process.argv.slice(2);
  const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
  if(!dir) throw new Error('Use freeze|run|report RUN_DIRECTORY [--coverage added|full] [--num_workers 16]');
  const destination=path.resolve(root,dir);
  Promise.resolve().then(()=>command==='freeze'?freeze(destination,option('--coverage','added')):command==='run'?run(destination,Number(option('--num_workers','16'))):command==='report'?report(destination):Promise.reject(new Error('Unknown command'))).catch(error=>{console.error(error.stack);process.exitCode=1;});
}
