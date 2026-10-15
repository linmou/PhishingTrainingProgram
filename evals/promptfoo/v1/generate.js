#!/usr/bin/env node
// Purpose: preserve a complete target-generation preflight with deterministic diagnostics before spending on full semantic judging; this is never an acceptance run.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {generateTarget,messagesFor,sha,rubricsFor}=require('./runner');
const metrics=require('../rubrics/v1/decision-metrics');
const length=require('../rubrics/v0/response-length-rubric');
const manifest=require('../rubrics/v1/manifest.json');
const root=path.resolve(__dirname,'../../..');
const {isDeepStrictEqual:same}=require('node:util');
function diagnostics(c,target,contractVersion){
 const evaluatedText=target.error?'':target.text;let parsed;try{parsed=JSON.parse(evaluatedText);}catch{parsed=null;}
 const ctx={vars:{expected_mode:c.expected.mode,expected_instruction:c.expected.instruction}};
 const parsedForEvaluation=contractVersion==='v2'&&parsed?{...parsed,reasoning:parsed.reason,mode:parsed.decision?.mode,mode_reason:parsed.reason,suggested_response:parsed.response}:parsed;
 const checks=[contractVersion==='v2'?metrics.contractValidityV2(evaluatedText):metrics.contractValidity(evaluatedText),contractVersion==='v2'?metrics.modeSelectionV2(evaluatedText,ctx):metrics.modeSelection(evaluatedText,ctx),{metric:'response_length',...length(parsedForEvaluation?.suggested_response)}];
 if(c.expected.checks.includes('instruction_selection'))checks.push(contractVersion==='v2'?metrics.instructionSelectionV2(evaluatedText,ctx):metrics.instructionSelection(evaluatedText,ctx));
 return {parsed,parsed_for_evaluation:parsedForEvaluation,results:checks.map(result=>({...result,method:'deterministic',status:result.pass?'pass':'fail'}))};
}
function validateCached(record,c,repetition,messages,settings,contractVersion,fingerprint,variant){
 const expectedRequest={model:settings.model,messages,temperature:settings.target_temperature,max_tokens:settings.target_max_tokens,enable_thinking:Boolean(settings.target_enable_thinking),response_format:{type:'json_object'}};
 const original=record.target?.format_repair?.initial||record.target,last=record.new_target_calls?.at(-1);
 const fields=['request','attempts','payload','text'];
 const mismatch=record.fingerprint!==fingerprint||record.case_id!==c.id||record.repetition!==repetition||!same(record.input,c)||record.source_type!==c.source_type||record.role!==c.role||!same(record.partitions,c.partitions)||record.contract_version!==contractVersion||record.semantic_status!=='unrun'||!same(original?.request,expectedRequest)||record.target_generation!==(record.target?.payload?.id||null)||!record.new_target_calls?.length||!same(record.new_target_calls[0],original)||fields.some(field=>!same(record.target?.[field],last?.[field]));
 if(mismatch)throw new Error('Cached generation identity mismatch: '+c.id+':'+repetition);
 if(record.new_target_calls.length!==(record.target.format_repair?2:1))throw new Error('Cached target call history mismatch.');
 for(const call of record.new_target_calls)if(!same({...call.request,messages},expectedRequest))throw new Error('Cached target settings mismatch: '+c.id+':'+repetition);
 if(variant==='product'||contractVersion==='v2'){
  const adapter=require('./product-adapter');
  const finalMessages=record.target.format_repair?adapter.productionRepair(messages):messages;
  if(!same(record.target.request.messages,finalMessages)||(!record.target.error&&!adapter.productionValid(record.target)))throw new Error('Cached production target mismatch.');
 }
 const expected=diagnostics(c,record.target,contractVersion);
 if(Object.keys(expected).some(key=>!same(record[key],expected[key])))throw new Error('Cached diagnostic evidence mismatch: '+c.id+':'+repetition);
}
function validateAggregates(out,results,fingerprint){
 const reportFile=path.join(out,'report.json'),summaryFile=path.join(out,'preflight.json');
 if(fs.existsSync(reportFile)){
  const saved=JSON.parse(fs.readFileSync(reportFile,'utf8'));
  if(saved.fingerprint!==fingerprint||saved.semantic_status!=='unrun'||!same(saved.results,results))throw new Error('Cached report differs from validated generation records.');
 }
 if(fs.existsSync(summaryFile)){
  const saved=JSON.parse(fs.readFileSync(summaryFile,'utf8'));
  const failures=results.flatMap(r=>r.results.filter(x=>!x.pass).map(x=>({case_id:r.case_id,repetition:r.repetition,...x})));
  if(saved.generations!==results.length||saved.semantic_status!=='unrun'||!same(saved.failures,failures))throw new Error('Cached summary differs from validated generation records.');
 }
}
async function runPreflight(options,generate=generateTarget){
 const {caseFile,policyFile,out,contractVersion='legacy',variant='candidate',settingsFile=path.join(__dirname,'settings.json'),regenerateRoomPrompt=false,workers=6}=options;
 if(!caseFile||!policyFile||!out)throw new Error('Supply cases, policy, and new output directory.');
 if(!['candidate','product'].includes(variant)||!['legacy','v2'].includes(contractVersion))throw new Error('Unsupported variant or contract.');
 if(variant==='product'&&contractVersion!=='v2')throw new Error('Product preflight requires contract v2.');
 if(regenerateRoomPrompt&&variant!=='product')throw new Error('Room regeneration requires the product variant.');
 if(!Number.isInteger(workers)||workers<1)throw new Error('workers must be a positive integer.');
 const cases=JSON.parse(fs.readFileSync(caseFile,'utf8')),policy=fs.readFileSync(policyFile,'utf8'),settings=JSON.parse(fs.readFileSync(settingsFile,'utf8'));
 if(!Array.isArray(cases)||!cases.length||cases.some(c=>!c.id)||new Set(cases.map(c=>c.id)).size!==cases.length)throw new Error('Cases must be nonempty with unique IDs.');
 if(!Number.isInteger(settings.repetitions)||settings.repetitions<1)throw new Error('repetitions must be a positive integer.');
 const dependencies=['generate.js','runner.js','evaluator.js','product-adapter.js','../rubrics/v1/decision-metrics.js','../rubrics/v0/response-length-rubric.js'].map(file=>({file,content:fs.readFileSync(path.join(__dirname,file),'utf8')}));
 if(variant==='product'||contractVersion==='v2')for(const file of ['tutor-system/src/services/ecologicalTutorCall.ts','tutor-system/src/services/prompts/activeTutorAgentPrompt.ts','tutor-system/src/services/aiService.ts','tutor-system/src/services/tutorDecisionContract.ts'])dependencies.push({file,content:fs.readFileSync(path.join(root,file),'utf8')});
 if(variant==='product'){
  const files=['tutor-system/src/services/systemPrompts.ts',...fs.readdirSync(path.join(root,'tutor-system/src/services/prompts'),{recursive:true}).filter(file=>file.endsWith('.ts')).map(file=>'tutor-system/src/services/prompts/'+file)];
  for(const file of files)if(!dependencies.some(item=>item.file===file))dependencies.push({file,content:fs.readFileSync(path.join(root,file),'utf8')});
 }
 const identity={cases,policy,settings,variant,contract_version:contractVersion,regenerate_room_prompt:regenerateRoomPrompt,manifest,rubrics:Object.fromEntries(cases.map(c=>[c.id,rubricsFor(c)])),sources:manifest.sources.map(source=>({...source,content:fs.readFileSync(path.join(root,source.path),'utf8')})),dependencies},fingerprint=sha(identity);
 fs.mkdirSync(out,{recursive:true});
 const snapshot=path.join(out,'snapshot.json');
 if(fs.existsSync(snapshot)){if(JSON.parse(fs.readFileSync(snapshot,'utf8')).fingerprint!==fingerprint)throw new Error('Resume fingerprint mismatch.');}
 else fs.writeFileSync(snapshot,JSON.stringify({fingerprint,started_at:new Date().toISOString(),command:process.argv,purpose:'Target-only diagnostic; all semantic gates unrun',...identity},null,2)+'\n',{flag:'wx'});
 const jobs=cases.flatMap(c=>Array.from({length:settings.repetitions},(_,repetition)=>({c,repetition})));let cursor=0;
 const cached=new Map();
 for(const {c,repetition}of jobs){
  const file=path.join(out,c.id+'-'+repetition+'.json');
  if(!fs.existsSync(file))continue;
  const record=JSON.parse(fs.readFileSync(file,'utf8'));
  validateCached(record,c,repetition,messagesFor(c,variant,policy,contractVersion,regenerateRoomPrompt),settings,contractVersion,fingerprint,variant);
  cached.set(file,record);
 }
 if(fs.existsSync(path.join(out,'report.json'))||fs.existsSync(path.join(out,'preflight.json'))){
  if(cached.size!==jobs.length)throw new Error('Completed preflight has missing generation evidence; refusing to regenerate.');
  validateAggregates(out,[...cached.values()],fingerprint);
 }
 await Promise.all(Array.from({length:workers},async()=>{
  while(cursor<jobs.length){
   const {c,repetition}=jobs[cursor++],file=path.join(out,c.id+'-'+repetition+'.json');
   const messages=messagesFor(c,variant,policy,contractVersion,regenerateRoomPrompt);
   if(cached.has(file))continue;
   const generated=await generate(messages,variant,settings,undefined,contractVersion),target=generated.target;
   const diagnostic=diagnostics(c,target,contractVersion),results=diagnostic.results;
   fs.writeFileSync(file,JSON.stringify({fingerprint,case_id:c.id,repetition,source_type:c.source_type,role:c.role,partitions:c.partitions,target_generation:target.payload?.id||null,new_target_calls:generated.calls,input:c,target,...diagnostic,semantic_status:'unrun',contract_version:contractVersion},null,2)+'\n',{flag:'wx'});
   console.log(c.id,repetition,results.filter(r=>!r.pass).map(r=>r.metric).join(',')||'deterministic-pass');
  }
 }));
 const results=jobs.map(({c,repetition})=>{
  const record=JSON.parse(fs.readFileSync(path.join(out,c.id+'-'+repetition+'.json'),'utf8'));
  validateCached(record,c,repetition,messagesFor(c,variant,policy,contractVersion,regenerateRoomPrompt),settings,contractVersion,fingerprint,variant);
  return record;
 });
 const summary={completed_at:new Date().toISOString(),generations:results.length,semantic_status:'unrun',failures:results.flatMap(r=>r.results.filter(x=>!x.pass).map(x=>({case_id:r.case_id,repetition:r.repetition,...x})))};
 validateAggregates(out,results,fingerprint);
 const file=path.join(out,'preflight.json');if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 const reportFile=path.join(out,'report.json');if(!fs.existsSync(reportFile))fs.writeFileSync(reportFile,JSON.stringify({fingerprint,completed_at:summary.completed_at,semantic_status:'unrun',results},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({generations:summary.generations,deterministic_failures:summary.failures.length,semantic_status:'unrun'}));
 return summary;
}
if(require.main===module){
 const [caseFile,policyFile,out,contractVersion='legacy',...flags]=process.argv.slice(2);
 if(flags.length%2)throw new Error('Options require explicit values.');
 const args=Object.fromEntries(flags.reduce((pairs,value,i,all)=>i%2?pairs:[...pairs,[value.replace(/^--/,''),all[i+1]]],[]));
 if(Object.keys(args).some(key=>!['variant','settings','regenerate_room_prompt','workers'].includes(key)))throw new Error('Unknown preflight option.');
 if(args.regenerate_room_prompt!==undefined&&!['true','false'].includes(args.regenerate_room_prompt))throw new Error('regenerate_room_prompt must be true or false.');
 runPreflight({caseFile,policyFile,out,contractVersion,variant:args.variant||'candidate',settingsFile:args.settings,regenerateRoomPrompt:args.regenerate_room_prompt==='true',workers:Number(args.workers||6)}).catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={runPreflight};
