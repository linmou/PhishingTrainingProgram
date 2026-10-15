#!/usr/bin/env node
// Test responsibility: current.cjs retains expanded coverage, real consumer behavior, and frozen request identity when resuming or reporting.
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {addedCases,suiteCases,aliasesFor,freeze,hash,generations,report,validateManifest}=require('./current.cjs');
const {loadProduction,executeTarget,score}=require('./evaluate.cjs');

test('added cases preserve branch labels; full coverage retains all original cases and separate propagated steps',()=>{
  const added=addedCases(), full=suiteCases('full');
  assert.equal(added.length,40);assert.equal(full.cases.length,118);assert.equal(full.original_case_ids.length,73);
  assert.equal(new Set(full.cases.map(c=>c.id)).size,118);
  assert.equal(full.cases.filter(c=>c.sequence_id).length,5);
  assert.ok(full.cases.filter(c=>c.sequence_id).every(c=>c.classification_applicable===false));
  assert.ok(full.cases.filter(c=>full.original_case_ids.includes(c.id)).every(c=>!c.sequence_id));
  assert.deepEqual(aliasesFor(added),{af86353_V01:'af86353_N08',af86353_V03:'af86353_N04'});
  for(const c of added){assert.equal(c.expected.kind,c.provenance.original_expected.kind);assert.equal(c.provenance.holdout_eligible,false);assert.equal(c.input.items.length,1);assert.ok(!JSON.stringify(c.input).includes(c.id));}
});

test('real handler evidence resumes unchanged; tampered cached requests, aliases, and empty coverage fail closed',async()=>{
  const dir=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'transfer-current-test-')),'run');
  const frozen=freeze(dir,'added'), target=loadProduction(frozen.snapshot);
  assert.equal(frozen.expected_provider_calls,114);assert.equal(frozen.expected_generations,120);
  const c=frozen.cases.find(c=>c.id==='af86353_N04');
  const result=await executeTarget(c,target,async request=>({request,status:200,response:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({events:[],explanation:'No event in this test response.'})}}]}}));
  assert.equal(result.http_status,200);
  const g={case_id:c.id,version:c.version,suite:c.suite,partition:c.partition,repetition:1,generation_id:'test/1',frozen_sha256:hash(frozen),reused_from:null,result,checks:score(c,result)};
  const folder=path.join(dir,'generations');fs.mkdirSync(folder);
  const file=path.join(folder,c.id+'-r1.json');
  fs.writeFileSync(file,JSON.stringify(g));
  assert.equal((await generations(dir,frozen)).length,1);
  const summary=await report(dir);assert.equal(summary.complete,false);assert.equal(summary.verdict,'incomplete');
  const wrong=structuredClone(g);wrong.result.calls[0].request.model='wrong-model';
  fs.writeFileSync(file,JSON.stringify(wrong));
  await assert.rejects(()=>generations(dir,frozen),/request drift/);
  fs.writeFileSync(file,JSON.stringify(g));
  const alias=frozen.cases.find(c=>c.id==='af86353_V03');
  const copied={...g,case_id:alias.id,suite:alias.suite,partition:alias.partition,generation_id:'alias/1',reused_from:c.id+'-r1.json',checks:score(alias,result)};
  const aliasFile=path.join(folder,alias.id+'-r1.json');fs.writeFileSync(aliasFile,JSON.stringify(copied));
  assert.equal((await generations(dir,frozen)).length,2);
  copied.result=structuredClone(result);copied.result.calls[0].response.usage={prompt_tokens:123};
  fs.writeFileSync(aliasFile,JSON.stringify(copied));
  await assert.rejects(()=>generations(dir,frozen),/alias linkage/);
  assert.throws(()=>validateManifest({...frozen,cases:[]}),/nonempty/);
  const drift=structuredClone(frozen);drift.artifacts[0].content+='\n';
  assert.throws(()=>validateManifest(drift),/Corrupt frozen artifact/);
});
