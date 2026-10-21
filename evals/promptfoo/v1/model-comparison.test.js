#!/usr/bin/env node
// File: model-comparison.js. Purpose: verify model injection and bounded concurrency, including failures, without making provider calls.
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fixedModel,modelSnapshot,matchingRequest,limiter} = require('./model-comparison');
const fs = require('node:fs');
const path = require('node:path');
const transfer = require('../learning-progress-analyzer/evaluate.cjs');

test('frozen handler model pin and injected model agree before calling the provider',async()=>{
  const frozen=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../output/transfer-analysis-current/full-candidate02-20261015/frozen.json'),'utf8'));
  const saved=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../output/transfer-analysis-current/full-candidate02-20261015/generations/E01-r1.json'),'utf8'));
  const snapshot=modelSnapshot(frozen.snapshot,'qwen3.8-flash');
  const target=fixedModel(transfer.loadProduction(snapshot),'qwen3.8-flash');let calls=0;
  const result=await transfer.executeTarget(frozen.cases[0],target,async request=>{
    calls++;assert.equal(request.model,'qwen3.8-flash');assert.equal(request.max_tokens,600);assert.equal(request.enable_thinking,false);
    return {request,status:200,response:saved.result.calls[0].response};
  });
  assert.equal(calls,1);assert.equal(result.http_status,200);
  const savedResult=JSON.parse(JSON.stringify(result));
  const replayed=await transfer.executeTarget(frozen.cases[0],target,async request=>({request,status:200,response:saved.result.calls[0].response}));
  for(const key of ['parsed','applied','http_status','prior_state','next_state','applied_event','projected_assessment_due'])assert.equal(JSON.stringify(replayed[key]),JSON.stringify(savedResult[key]));
  assert.deepEqual(snapshot.files.filter(f=>f.name!=='supabase/functions/assessment-api/index.ts'),frozen.snapshot.files.filter(f=>f.name!=='supabase/functions/assessment-api/index.ts'));
  assert.deepEqual(modelSnapshot(frozen.snapshot,'qwen3.5-flash').files.map(f=>f.content.replaceAll('"qwen3.5-flash"',"'qwen3.5-flash'")),frozen.snapshot.files.map(f=>f.content));
});

test('model-only request comparison rejects message and decoding drift',()=>{
  const original={model:'baseline',messages:[{role:'user',content:'fixed input'}],temperature:0.3,max_tokens:100,enable_thinking:false};
  matchingRequest({request:{...original,model:'candidate'}},original,'baseline');
  assert.throws(()=>matchingRequest({request:{...original,messages:[{role:'user',content:'changed'}]}},original,'baseline'));
  assert.throws(()=>matchingRequest({request:{...original,max_tokens:600}},original,'baseline'));
});

test('model injection reaches the handler environment and preserves other dependencies',()=>{
  const original={createAssessmentApiHandler:deps=>deps,evaluationPrompt:'unchanged'};
  const env=name=>({OAI_MODEL:'old',OAI_API_KEY:'injected',OAI_BASE_URL:'https://test.invalid'})[name];
  const marker={};
  const wrapped=fixedModel(original,'candidate');
  const deps=wrapped.createAssessmentApiHandler({env,marker});
  assert.equal(deps.env('OAI_MODEL'),'candidate');
  assert.equal(deps.env('OAI_API_KEY'),'injected');
  assert.equal(deps.env('OAI_BASE_URL'),'https://test.invalid');
  assert.equal(deps.env('missing'),undefined);
  assert.equal(deps.marker,marker);
  assert.equal(env('OAI_MODEL'),'old');
  assert.equal(wrapped.evaluationPrompt,'unchanged');
});

test('request limiter remains bounded and releases slots on errors',async()=>{
  const limit=limiter(2);let active=0,maximum=0;
  const outcomes=await Promise.allSettled(Array.from({length:8},(_,i)=>limit(async()=>{
    active++;maximum=Math.max(maximum,active);
    await new Promise(resolve=>setTimeout(resolve,5));active--;
    if(i%3===0)throw Error('expected failure');return i;
  })));
  assert.equal(maximum,2);
  assert.equal(active,0);
  assert.equal(outcomes.filter(x=>x.status==='rejected').length,3);
  assert.equal(await limit(async()=>42),42);
});
