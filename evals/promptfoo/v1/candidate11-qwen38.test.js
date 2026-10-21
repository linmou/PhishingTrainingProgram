#!/usr/bin/env node
// File: candidate11-qwen38.js. Purpose: verify frozen request boundaries, native format repair and failure preservation without provider calls.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {validateRequest,validate}=require('./candidate11-qwen38'),runner=require('./runner');
const out=path.resolve(__dirname,'../../../output/candidate11-qwen38-20261015/full-02');
test('frozen full11 retains183historical initial inputs and183completed3.8baseline records',()=>{
  const manifest=validate(out);assert.equal(manifest.records.length,183);assert.equal(manifest.reference.cases.length,61);
  assert.equal(manifest.dependency_changes.length,3);assert.equal(manifest.settings.target_max_tokens,100);assert.equal(manifest.settings.target_enable_thinking,false);
  for(const ref of manifest.records){const old=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',ref.historical.path)));assert.deepEqual(ref.messages,(old.target.format_repair?.initial||old.target).request.messages);}
});
test('decoding and prompt drift fail validation rather than become a reusable target',()=>{
  const messages=[{role:'system',content:'frozen policy'},{role:'user',content:'frozen case'}],settings={model:'qwen3.8-flash'};
  const request={model:settings.model,messages,temperature:0.3,max_tokens:100,enable_thinking:false,response_format:{type:'json_object'}};
  validateRequest({request},messages,settings);
  for(const change of [{model:'qwen3.5-flash'},{max_tokens:8000},{enable_thinking:true},{messages:[...messages,{role:'user',content:'extra instruction'}]}])assert.throws(()=>validateRequest({request:{...request,...change}},messages,settings));
});
test('native generator retains invalid first output and exactlyone production format repair',async()=>{
  const originalFetch=global.fetch,originalKey=process.env.OAI_API_KEY,originalBase=process.env.OAI_BASE_URL;
  process.env.OAI_API_KEY='test-key';process.env.OAI_BASE_URL='https://test.invalid';
  const messages=[{role:'system',content:'frozen policy'},{role:'user',content:'frozen case'}],requests=[];
  const settings={model:'qwen3.8-flash',target_temperature:0.3,target_max_tokens:100,target_enable_thinking:false,target_format_attempts:2,transport_attempts:1,timeout_ms:1000,request_concurrency:1};
  global.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({id:'test-'+requests.length,model:settings.model,choices:[{message:{content:'invalid JSON'},finish_reason:'stop'}]}),{status:200});};
  try{const generated=await runner.generateTarget(messages,'product',settings,undefined,'v2');
    assert.equal(requests.length,2);assert.equal(generated.calls.length,2);assert.equal(generated.target.format_repair.initial.text,'invalid JSON');assert(generated.target.error);
    validateRequest(generated.target,messages,settings);
  }finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OAI_API_KEY;else process.env.OAI_API_KEY=originalKey;if(originalBase===undefined)delete process.env.OAI_BASE_URL;else process.env.OAI_BASE_URL=originalBase;}
});
