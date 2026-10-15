#!/usr/bin/env node
// Purpose: reconcile every mixed-method assertion, partition, hard constraint, pair, transition, and same-case baseline comparison.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const sha=require('./runner').sha;
function expectedIds(c){return [...c.expected.checks,...(c.legacy||[]).map(a=>a.id)];}
// Additive transfer gate registration: the transfer quality gate consumes this snapshot, while
// assess() keeps reconciling exactly the legacy metrics and thresholds it reconciled before.
const gateExtensions=new Map();
function registerGateExtension(id,extension){if(!id||typeof id!=='string')throw new Error('A gate extension id is required.');if(gateExtensions.has(id))throw new Error(`Gate extension ${id} is already registered.`);gateExtensions.set(id,{...extension,id});return gateExtensions.get(id);}
function gateExtension(id){return gateExtensions.get(id)||null;}
function metricInfo(record,id,definition){
 const legacy=(record.input.legacy||[]).find(a=>a.id===id);
 if(legacy)return {id:'v0:'+legacy.metric,method:legacy.type==='javascript'?'deterministic':'llm_rubric',gate:['retained_regression','retained_supporting'].includes(legacy.disposition),threshold:legacy.metric==='response_length'?1:0.8,legacy:true};
 const check=[...definition.checks,...definition.retained_supporting_checks].find(m=>m.id===id);
 return {id,method:check?.method,gate:true,threshold:check?.threshold??0.8,hard:check?.hard_partitions||[],legacy:false};
}
function validateEvidence(report,snapshot,side,fail){
 const cases=new Map(snapshot.cases.map(c=>[c.id,c]));
 const seen=new Set();
 for(const record of report.results||[]){
  const key=record.case_id+':'+record.repetition,c=cases.get(record.case_id);
  if(seen.has(key))fail('duplicate_generation',{side,key});
  seen.add(key);
  if(!c||!Number.isInteger(record.repetition)||record.repetition<0||record.repetition>=snapshot.settings.repetitions){fail('unexpected_generation',{side,key});continue;}
  if(sha(record.input)!==sha(c))fail('changed_case_input',{side,key});
  if(record.source_type!==c.source_type||record.role!==c.role||sha(record.partitions||[])!==sha(c.partitions||[]))fail('changed_partition_metadata',{side,key});
  if(record.target?.error)fail('target_error',{side,key,reason:record.target.error});
  const assertions=new Set();
  for(const result of record.results||[]){
   const id=result.metric;
   if(assertions.has(id))fail('duplicate_assertion',{side,key,metric:id});
   assertions.add(id);
   if(!expectedIds(c).includes(id)){fail('unexpected_assertion',{side,key,metric:id});continue;}
   const legacy=(c.legacy||[]).find(a=>a.id===id);
   const check=[...snapshot.manifest.checks,...snapshot.manifest.retained_supporting_checks].find(m=>m.id===id);
   const method=legacy?(legacy.type==='javascript'?'deterministic':'llm_rubric'):check?.method;
   if(!method||result.method!==method)fail('invalid_method',{side,key,metric:id,expected:method,actual:result.method});
   if(!['pass','fail','error','missing','not_applicable'].includes(result.status))fail('invalid_status',{side,key,metric:id});
   if(['error','missing'].includes(result.status))fail('unevaluable_assertion',{side,key,metric:id,status:result.status,reason:result.reason});
   if(['pass','fail'].includes(result.status)&&(result.pass!==(result.status==='pass')||result.score!==Number(result.pass)))fail('malformed_assertion',{side,key,metric:id});
   if(result.status==='not_applicable'&&(!['contribution_feedback','contextual_knowledge_quality'].includes(id)||result.applicable!==false||result.pass!==null||result.score!==null))fail('invalid_inapplicability',{side,key,metric:id});
   if(id==='contextual_knowledge_quality'&&c.expected.knowledge_required&&result.status==='not_applicable')fail('required_content_excluded',{side,key,metric:id});
   if(id==='contextual_knowledge_quality'&&((result.status==='not_applicable'&&result.accuracy_pass!==null)||(['pass','fail'].includes(result.status)&&typeof result.accuracy_pass!=='boolean')))fail('malformed_accuracy',{side,key,metric:id});
  }
  for(const id of expectedIds(c))if(!assertions.has(id))fail('missing_assertion',{side,key,metric:id});
 }
 for(const c of snapshot.cases)for(let rep=0;rep<snapshot.settings.repetitions;rep++)if(!seen.has(c.id+':'+rep))fail('missing_generation',{side,key:c.id+':'+rep});
}
function assess(report,snapshot,baseline,baselineSnapshot){
 const definition=snapshot.manifest;
 const issues=[],rows=new Map(),newFailures=[],applicabilityChanges=[];
 const fail=(type,detail)=>issues.push({type,...detail});
 if(!Array.isArray(snapshot.cases)||!snapshot.cases.length||!Number.isInteger(snapshot.settings?.repetitions)||snapshot.settings.repetitions<1||!definition?.checks||!definition?.retained_supporting_checks||snapshot.cases.some(c=>!c.id||!Array.isArray(c.expected?.checks)||!expectedIds(c).length||new Set(expectedIds(c)).size!==expectedIds(c).length)||new Set(snapshot.cases.map(c=>c.id)).size!==snapshot.cases.length){
  return {verdict:'failed',generation_count:0,metrics:[],issues:[{type:'invalid_manifest'}],new_failures:[],applicability_changes:[],pairs:0};
 }
 validateEvidence(report,snapshot,'candidate',fail);
 const expected=snapshot.cases.flatMap(c=>Array.from({length:snapshot.settings.repetitions},(_,repetition)=>({c,repetition,key:c.id+':'+repetition})));
 const byKey=new Map();
 for(const r of report.results){const key=r.case_id+':'+r.repetition;if(byKey.has(key))fail('duplicate_generation',{key});byKey.set(key,r);}
 if(baseline){
   for(const field of ['cases','settings','rubrics','manifest'])if(sha(snapshot[field])!==sha(baselineSnapshot[field]))fail('incomparable_baseline',{field});
   validateEvidence(baseline,snapshot,'baseline',fail);
 }
 const baseByKey=new Map((baseline?.results||[]).map(r=>[r.case_id+':'+r.repetition,r]));
 for(const job of expected){
  const supplied=byKey.get(job.key);
  const record={...supplied,input:job.c,source_type:job.c.source_type,role:job.c.role,partitions:job.c.partitions||[],results:supplied?.results||[]};
  const resultMap=new Map();for(const r of record.results){if(resultMap.has(r.metric))fail('duplicate_assertion',{key:job.key,metric:r.metric});resultMap.set(r.metric,r);}
  for(const id of expectedIds(job.c)){
   const r=resultMap.get(id)||{metric:id,status:'missing',pass:false,score:0},info=metricInfo(record,id,definition);
   if(['error','missing'].includes(r.status))fail('unevaluable_assertion',{key:job.key,metric:id,status:r.status,reason:r.reason});
   if(r.status==='not_applicable'&&(!['contribution_feedback','contextual_knowledge_quality'].includes(id)||r.applicable!==false||r.pass!==null||r.score!==null))fail('invalid_inapplicability',{key:job.key,metric:id});
   if(id==='contextual_knowledge_quality'&&job.c.expected.knowledge_required&&r.status==='not_applicable')fail('required_content_excluded',{key:job.key});
   if(id==='contextual_knowledge_quality'&&r.accuracy_pass===false)fail('H1_accuracy',{key:job.key,reason:r.reason});
   const partitions=['overall','source:'+record.source_type,...(info.id.endsWith('persona_stability')?['role:'+record.role]:[]),...(record.partitions||[]).filter(p=>info.hard?.includes(p))];
   for(const partition of partitions){
    const key=info.id+'|'+partition;
    if(!rows.has(key))rows.set(key,{metric:info.id,method:info.method,partition,gate:info.gate,threshold:info.hard?.includes(partition)?1:info.threshold,expected:0,applicable:0,passed:0,inapplicable:0,errors:0,baseline_applicable:0,baseline_passed:0});
    const row=rows.get(key);row.expected++;
    if(r.status==='not_applicable')row.inapplicable++;else {row.applicable++;if(r.status==='pass'&&r.pass===true)row.passed++;if(['error','missing'].includes(r.status))row.errors++;}
    const old=baseByKey.get(job.key)?.results.find(x=>x.metric===id);
    if(baseline&&!old)fail('missing_baseline_assertion',{key:job.key,metric:id});
    if(old&&old.status!=='not_applicable'&&r.status!=='not_applicable'){row.baseline_applicable++;if(old.status==='pass'&&old.pass)row.baseline_passed++;}
   }
   const old=baseByKey.get(job.key)?.results.find(x=>x.metric===id);
   if(old&&old.status==='pass'&&r.status==='fail')newFailures.push({key:job.key,metric:id,gate:info.gate,baseline:old.reason,candidate:r.reason});
   if(old&&((old.status==='not_applicable')!==(r.status==='not_applicable'))){
    applicabilityChanges.push({key:job.key,metric:id,before:old.status,after:r.status});
    if(old.status==='fail'&&r.status==='not_applicable'&&info.gate)fail('failed_baseline_became_inapplicable',{key:job.key,metric:id});
   }
  }
  for(const id of resultMap.keys())if(!expectedIds(job.c).includes(id))fail('unexpected_assertion',{key:job.key,metric:id});
  if(job.c.transition){const m=resultMap.get('mode_selection');const actualMode=record.parsed_for_evaluation?.mode||record.parsed?.mode;if(job.c.input.prior_mode!==job.c.transition.from||actualMode!==job.c.transition.to||m?.status!=='pass')fail('transition',{key:job.key,expected:job.c.transition,actual:actualMode});}
 }
 for(const key of byKey.keys())if(!expected.some(j=>j.key===key))fail('unexpected_generation',{key});
 for(const row of rows.values()){
  row.verdict=!row.applicable?'unmeasured':row.passed/row.applicable>=row.threshold?'pass':'fail';
  if(row.gate&&row.verdict!=='pass')fail(row.verdict==='unmeasured'?'no_applicable_coverage':'below_threshold',{metric:row.metric,partition:row.partition,passed:row.passed,expected:row.applicable,threshold:row.threshold});
  if(baseline&&row.gate){
   const comparable=expected.flatMap(j=>{
    const r=byKey.get(j.key),b=baseByKey.get(j.key);if(!r||!b)return[];
    if(!['overall','source:'+j.c.source_type,'role:'+j.c.role,...(j.c.partitions||[])].includes(row.partition))return[];
    return r.results.filter(x=>metricInfo(r,x.metric,definition).id===row.metric).flatMap(x=>{const old=b.results.find(y=>y.metric===x.metric);return old&&old.status!=='not_applicable'&&x.status!=='not_applicable'?[{pass:x.status==='pass',base:old.status==='pass'}]:[];});
   });
   const wins=comparable.filter(x=>x.pass).length,baseWins=comparable.filter(x=>x.base).length;
   row.comparable_count=comparable.length;row.candidate_comparable_passed=wins;row.baseline_comparable_passed=baseWins;
   if(wins<baseWins)fail('regression',{metric:row.metric,partition:row.partition,baseline:baseWins,candidate:wins,expected:comparable.length});
  }
 }
 const pairs=new Map();for(const c of snapshot.cases)if(c.pair_id){if(!pairs.has(c.pair_id))pairs.set(c.pair_id,[]);pairs.get(c.pair_id).push(c);}
 for(const [id,members]of pairs){if(members.length!==2)fail('invalid_pair',{id,members:members.length});for(const c of members)for(let rep=0;rep<snapshot.settings.repetitions;rep++){
  const r=byKey.get(c.id+':'+rep);if(!r||r.results.some(x=>metricInfo(r,x.metric,definition).gate&&!['pass','not_applicable'].includes(x.status)))fail('pair',{id,case_id:c.id,repetition:rep});
 }}
 return {verdict:issues.length?'failed':'accepted',generation_count:expected.length,metrics:[...rows.values()],issues,new_failures:newFailures,applicability_changes:applicabilityChanges,pairs:pairs.size,limitations:['Acceptance requires separately recorded constitutional grounding, calibration and independent holdout provenance. This gate does not confer deployment approval.']};
}
if(require.main===module){
 const dir=process.argv[2],base=process.argv[3];if(!dir)throw new Error('Supply candidate run directory and optional baseline directory.');
 const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
 const result=assess(read(path.join(dir,'report.json')),read(path.join(dir,'snapshot.json')),base?read(path.join(base,'report.json')):null,base?read(path.join(base,'snapshot.json')):null);
 const out=path.join(dir,base?'comparison.json':'gate.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({verdict:result.verdict,issues:result.issues.length,issue_types:[...new Set(result.issues.map(i=>i.type))],metric_rows:result.metrics.length}));if(result.verdict!=='accepted')process.exitCode=1;
}
module.exports={assess,expectedIds,registerGateExtension,gateExtension};
