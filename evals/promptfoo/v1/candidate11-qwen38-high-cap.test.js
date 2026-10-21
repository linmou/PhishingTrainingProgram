#!/usr/bin/env node
// File: candidate11-qwen38-high-cap.js. Purpose: verify600token requests, strict comparison factors and outcome-independent exact judge-cache reuse without provider calls.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {actualKey,judgeRequest,validateTarget,comparisonSettings,validate}=require('./candidate11-qwen38-high-cap'),runner=require('./runner');
const out=path.resolve(__dirname,'../../../output/candidate11-qwen38-20261015/high-cap-600-01');
test('new condition retains183frozen inputs and source-priority cache provenance including failures',()=>{
  const m=validate(out);assert.equal(m.records.length,183);assert.equal(m.settings.target_max_tokens,600);assert.equal(m.judge_cache.length,5441);assert.equal(m.judge_cache_selected.length,5418);
  for(const group of m.judge_cache_selected){const ordered=[group.selected,...group.duplicates];assert.deepEqual(ordered,[...ordered].sort((a,b)=>a.rank-b.rank||a.path.localeCompare(b.path)));for(const source of ordered){const saved=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',source.path))),result=source.wrapped?saved.result:saved;assert.equal(actualKey(result.request),group.key);}}
  assert(m.judge_cache_selected.some(g=>{const s=g.selected,d=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',s.path)));return (s.wrapped?d.result:d).error;}));
});
test('judge identity uses complete actual provider request and rejects changed model or decoding',()=>{
  const messages=[{role:'user',content:'frozen evidence'}],request=judgeRequest(messages),key=actualKey(request);
  assert.equal(actualKey(structuredClone(request)),key);assert.notEqual(actualKey(judgeRequest([{role:'user',content:'changed evidence'}])),key);
  for(const change of [{model:'qwen3.8-flash'},{max_tokens:600},{enable_thinking:false},{temperature:0.3},{response_format:{type:'text'}}])assert.throws(()=>actualKey({...request,...change}));
});
test('comparison normalizes only declared token and concurrency differences',()=>{
  const baseline={model:'qwen3.8-flash',target_max_tokens:100,request_concurrency:24,target_temperature:0.3,target_enable_thinking:false,judge_max_tokens:8000};
  const candidate={...baseline,target_max_tokens:600,request_concurrency:48};assert.deepEqual(comparisonSettings(candidate,baseline),baseline);
  for(const change of [{target_temperature:0},{target_enable_thinking:true},{judge_max_tokens:600},{model:'qwen3.5-flash'}])assert.throws(()=>comparisonSettings({...candidate,...change},baseline));
});
test('native generator sends600tokens and retains bounded failed format repair',async()=>{
  const original=global.fetch,oldKey=process.env.OAI_API_KEY,oldBase=process.env.OAI_BASE_URL;process.env.OAI_API_KEY='test-key';process.env.OAI_BASE_URL='https://test.invalid';
  const messages=[{role:'system',content:'exact historical policy'},{role:'user',content:'exact case'}],requests=[];
  global.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({id:'test',model:'qwen3.8-flash',choices:[{message:{content:'invalid JSON'},finish_reason:'stop'}]}),{status:200});};
  try{const generated=await runner.generateTarget(messages,'product',{model:'qwen3.8-flash',target_temperature:0.3,target_max_tokens:600,target_enable_thinking:false,target_format_attempts:2,transport_attempts:1,timeout_ms:1000,request_concurrency:1},undefined,'v2');assert.equal(requests.length,2);assert(generated.target.error);assert.equal(generated.target.format_repair.initial.text,'invalid JSON');validateTarget(generated.target,messages);assert.throws(()=>validateTarget({...generated.target,request:{...generated.target.request,max_tokens:100}},messages));}
  finally{global.fetch=original;if(oldKey===undefined)delete process.env.OAI_API_KEY;else process.env.OAI_API_KEY=oldKey;if(oldBase===undefined)delete process.env.OAI_BASE_URL;else process.env.OAI_BASE_URL=oldBase;}
});
