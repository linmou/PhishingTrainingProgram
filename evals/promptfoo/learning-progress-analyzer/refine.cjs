#!/usr/bin/env node
// Purpose: freeze full prompt-only learning-progress analyzer refinements, reuse identical saved inputs, and compare all preserved gates.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {suiteCases,aliasesFor,validateManifest,generations,hash,report}=require('./current.cjs');
const {loadProduction}=require('./evaluate.cjs');
const root=path.resolve(__dirname,'../../..');
const ts=require(path.join(root,'tutor-system/node_modules/typescript'));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const save=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});};
function replacePrompt(source,prompt){
  const ast=ts.createSourceFile('analysis.ts',source,ts.ScriptTarget.Latest,true);
  const matches=ast.statements.filter(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)==='TRANSFER_ANALYSIS_SYSTEM_PROMPT'));
  if(matches.length!==1||matches[0].declarationList.declarations.length!==1)throw new Error('Analysis prompt boundary missing or ambiguous');
  const declaration=matches[0].declarationList.declarations[0];
  if(!declaration.initializer)throw new Error('Analysis prompt initializer missing');
  return source.slice(0,declaration.initializer.getStart(ast))+JSON.stringify(prompt)+source.slice(declaration.initializer.end);
}
function validateRefinementSource(frozen){const artifact=frozen.artifacts.find(a=>a.path===path.relative(root,__filename));if(!artifact||hash(fs.readFileSync(__filename,'utf8'))!==artifact.sha256)throw new Error('Refinement source drift');}
async function freeze(dir,reference,policy=null){
  if(fs.existsSync(dir))throw new Error('New directory required');
  const before=read(path.join(reference,'frozen.json'));validateManifest(before);
  const preserved=await generations(reference,before);
  const frozen=structuredClone(before),suite=suiteCases('full');
  Object.assign(frozen,suite,{run_id:path.basename(dir),frozen_at:new Date().toISOString(),coverage:'full',reference:path.relative(root,reference),comparison:'Prompt-only full-suite refinement; same current handler/reducer, original73 plus added40 and5 propagated sequence steps.'});
  frozen.aliases=aliasesFor(frozen.cases);frozen.expected_generations=frozen.cases.length*3;
  frozen.expected_provider_calls=(frozen.cases.length-Object.keys(frozen.aliases).length)*3;
  frozen.required_suites=[...new Set(frozen.cases.map(c=>c.suite))];frozen.required_partitions=[...new Set(frozen.cases.map(c=>c.partition))];
  frozen.artifacts=frozen.artifacts.filter(a=>a.path!==path.relative(root,__filename)&&!a.path.endsWith('/refinement-policy.md'));
  const content=fs.readFileSync(__filename,'utf8');frozen.artifacts.push({path:path.relative(root,__filename),content,sha256:hash(content)});
  if(policy){
    const prompt=fs.readFileSync(policy,'utf8').trim();
    const file=frozen.snapshot.files.find(f=>f.name==='supabase/functions/assessment-api/index.ts');
    file.content=replacePrompt(file.content,prompt);file.sha256=hash(file.content);
    frozen.prompt=loadProduction(frozen.snapshot).evaluationPrompt;frozen.prompt_sha256=hash(frozen.prompt);
    frozen.artifacts.push({path:path.relative(root,policy),content:fs.readFileSync(policy,'utf8'),sha256:hash(fs.readFileSync(policy,'utf8'))});
  }
  validateManifest(frozen);
  const reusable=frozen.prompt_sha256===before.prompt_sha256?preserved.filter(g=>{
    const old=before.cases.find(c=>c.id===g.case_id),next=frozen.cases.find(c=>c.id===g.case_id);
    return next&&!next.sequence_id&&hash(old.input)===hash(next.input)&&hash(old.expected)===hash(next.expected)&&old.sequence_id===next.sequence_id;
  }):[];
  save(path.join(dir,'frozen.json'),frozen);
  const entries=[];
  for(const g of reusable){
    const source=path.join(reference,'generations',`${g.case_id}-r${g.repetition}.json`);
    const copy={...g,frozen_sha256:hash(frozen),generation_id:`${frozen.run_id}/${g.case_id}/r${g.repetition}`,source_evidence:{file:path.relative(root,source),sha256:hash(fs.readFileSync(source,'utf8')),generation_id:g.generation_id}};
    save(path.join(dir,'generations',`${g.case_id}-r${g.repetition}.json`),copy);entries.push(copy.source_evidence);
  }
  await generations(dir,frozen);
  save(path.join(dir,'reuse-manifest.json'),{command:process.argv,at:new Date().toISOString(),reference:path.relative(root,reference),reference_frozen_sha256:hash(fs.readFileSync(path.join(reference,'frozen.json'),'utf8')),selection:'All available identical fixed-input records; preserve failures. Repetition identity never changes.',records:entries,expected_records:frozen.expected_generations,expected_unique_calls:frozen.expected_provider_calls,new_unique_calls:frozen.expected_provider_calls-reusable.filter(g=>!g.reused_from).length});
  console.log(JSON.stringify({dir,cases:frozen.cases.length,reused:reusable.length,new_calls:frozen.expected_provider_calls-reusable.filter(g=>!g.reused_from).length,prompt_sha256:frozen.prompt_sha256}));return frozen;
}
function comparable(a,b){
  for(const key of ['cases','settings','metrics','thresholds','classification_protocol','aliases','original_case_ids','required_suites','required_partitions'])if(hash(a[key])!==hash(b[key]))throw new Error('Noncomparable '+key);
  const normalized=f=>f.snapshot.files.map(x=>({name:x.name,content:x.name==='supabase/functions/assessment-api/index.ts'?replacePrompt(x.content,'PROMPT FACTOR'):x.content}));
  if(hash(normalized(a))!==hash(normalized(b)))throw new Error('Non-prompt consumer drift');
}
async function compare(baseline,candidate){
  const a=read(path.join(baseline,'frozen.json')),b=read(path.join(candidate,'frozen.json'));comparable(a,b);
  validateRefinementSource(a);validateRefinementSource(b);
  const before=await report(baseline),after=await report(candidate);
  const rows=after.rows.map(row=>{const old=before.rows.find(x=>x.metric===row.metric&&x.group===row.group);return {metric:row.metric,group:row.group,baseline:old.passed/old.expected,candidate:row.passed/row.expected,non_regression:row.passed>=old.passed};});
  const classification=after.classification.rows.filter(r=>!r.diagnostic).map(row=>{const old=before.classification.rows.find(r=>r.group===row.group&&r.view===row.view);return {group:row.group,view:row.view,baseline:old.macro_f1,candidate:row.macro_f1,non_regression:row.macro_f1>=old.macro_f1};});
  const original=await generations(baseline,a),current=await generations(candidate,b);
  const new_failures=current.flatMap(g=>{const old=original.find(x=>x.case_id===g.case_id&&x.repetition===g.repetition);return g.checks.filter(c=>c.status!=='pass'&&old?.checks.some(x=>x.metric===c.metric&&x.status==='pass')).map(c=>({case_id:g.case_id,repetition:g.repetition,metric:c.metric,expected:c.expected,actual:c.actual}));});
  const complete=before.complete&&after.complete;
  const conformance=complete&&after.rows.every(r=>r.verdict==='pass')&&after.pairs.every(p=>p.pass)&&after.classification.benchmark_pass&&rows.every(r=>r.non_regression)&&classification.every(r=>r.non_regression);
  const result={at:new Date().toISOString(),baseline:path.relative(root,baseline),candidate:path.relative(root,candidate),complete,benchmark_conformance:conformance?'pass':complete?'fail':'incomplete',acceptance:'pending human label review and independent unseen validation',rows,classification,new_failures};
  save(path.join(candidate,`comparison-${Date.now()}.json`),result);console.log(JSON.stringify({complete,benchmark_conformance:result.benchmark_conformance,regressions:rows.filter(r=>!r.non_regression).length,classification_regressions:classification.filter(r=>!r.non_regression).length,new_failures:new_failures.length}));return result;
}
module.exports={replacePrompt,freeze,comparable,compare};
if(require.main===module){const [command,a,b,...args]=process.argv.slice(2);Promise.resolve().then(()=>command==='freeze'?freeze(path.resolve(a),path.resolve(b),args.includes('--policy')?path.resolve(args[args.indexOf('--policy')+1]):null):command==='compare'?compare(path.resolve(a),path.resolve(b)):Promise.reject(new Error('Use freeze DIR REFERENCE [--policy FILE] or compare BASELINE CANDIDATE'))).catch(e=>{console.error(e.stack);process.exitCode=1;});}
