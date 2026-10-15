#!/usr/bin/env node
// Tests generate.js: product request parity, frozen diagnostic evidence, resume safety, and invalid-output handling; no semantic judgments or provider calls.
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {runPreflight}=require('./generate');
const {messagesFor,sha,run}=require('./runner');
const {assess}=require('./gate');
const caseDefinition=require('./development-with-guard-scenario-rich.json')[0];
const settings=require('../refinement-20261014/settings-r3.json');
const policyFile=path.resolve(__dirname,'../refinement-20261014/candidate-policy-02.md');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));

function fixture(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tutor-preflight-test-'));
  const caseFile=path.join(directory,'cases.json'),settingsFile=path.join(directory,'settings.json');
  fs.writeFileSync(caseFile,JSON.stringify([caseDefinition]));
  fs.writeFileSync(settingsFile,JSON.stringify(settings));
  return {caseFile,settingsFile,policyFile,out:path.join(directory,'run'),contractVersion:'v2',variant:'product',regenerateRoomPrompt:true,workers:2};
}

function stubTarget(messages,variant,config){
  assert.equal(variant,'product');
  const target={request:{messages,model:config.model,temperature:config.target_temperature,max_tokens:config.target_max_tokens,enable_thinking:config.target_enable_thinking,response_format:{type:'json_object'}},attempts:[],payload:{id:'test-generation',choices:[{finish_reason:'stop'}]},text:JSON.stringify({reason:'Evidence supports the selected next step.',decision:{mode:'tutoring',instruction:'explanation'},response:'Review the supplied evidence.'})};
  return {target,calls:[target]};
}

test('product preflight preserves exact request composition and leaves semantic acceptance unrun',async()=>{
  const options=fixture(),calls=[];
  const summary=await runPreflight(options,async(...args)=>{calls.push(args);return stubTarget(...args);});
  assert.equal(calls.length,settings.repetitions);
  const policy=fs.readFileSync(policyFile,'utf8');
  for(const [messages,variant,config,replay,contract]of calls){
    assert.deepEqual(messages,messagesFor(caseDefinition,'product',policy,'v2',true));
    assert.equal(variant,'product');assert.equal(contract,'v2');assert.equal(replay,undefined);
    assert.deepEqual(config,settings);
  }
  assert.equal(summary.semantic_status,'unrun');
  const snapshot=read(path.join(options.out,'snapshot.json')),report=read(path.join(options.out,'report.json'));
  assert.equal(snapshot.variant,'product');assert.equal(snapshot.regenerate_room_prompt,true);
  assert.ok(snapshot.dependencies.some(x=>x.file==='generate.js'));
  assert.ok(snapshot.dependencies.some(x=>x.file==='tutor-system/src/services/prompts/index.ts'));
  assert.equal(report.results.length,settings.repetitions);
  assert.ok(report.results.every(x=>x.semantic_status==='unrun'&&x.results.every(y=>y.method==='deterministic')));
  const gate=assess(report,snapshot);
  assert.equal(gate.verdict,'failed');
  assert.ok(gate.issues.some(x=>x.type==='missing_assertion'));
});

test('resume reuses all existing records and rejects changed settings',async()=>{
  const options=fixture();
  await runPreflight(options,stubTarget);
  const before=sha(fs.readFileSync(path.join(options.out,'report.json'),'utf8'));
  await runPreflight(options,()=>{throw new Error('Unexpected generation during resume');});
  assert.equal(sha(fs.readFileSync(path.join(options.out,'report.json'),'utf8')),before);
  const changed=path.join(path.dirname(options.out),'changed-settings.json');
  fs.writeFileSync(changed,JSON.stringify({...settings,target_max_tokens:settings.target_max_tokens+1}));
  await assert.rejects(runPreflight({...options,settingsFile:changed},stubTarget),/fingerprint mismatch/);
});

test('production errors retain raw text but cannot yield valid decision diagnostics',async()=>{
  const options=fixture();
  await runPreflight(options,(...args)=>{
    const generated=stubTarget(...args);
    generated.target.error='Production output invalid after configured repair.';
    return generated;
  });
  const report=read(path.join(options.out,'report.json'));
  for(const record of report.results){
    assert.ok(record.target.text);assert.ok(record.target.error);
    assert.equal(record.parsed,null);assert.equal(record.parsed_for_evaluation,null);
    assert.ok(record.results.every(result=>result.status==='fail'));
  }
});

test('unsupported product contracts and invalid worker settings fail before generation',async()=>{
  const options=fixture();
  await assert.rejects(runPreflight({...options,contractVersion:'legacy'},stubTarget),/requires contract v2/);
  await assert.rejects(runPreflight({...options,workers:0},stubTarget),/positive integer/);
  await assert.rejects(runPreflight({...options,variant:'candidate'},stubTarget),/regeneration requires the product/);
});

test('cached case, request, result and aggregate tampering is rejected without regeneration',async()=>{
  const options=fixture();await runPreflight(options,stubTarget);
  const file=path.join(options.out,caseDefinition.id+'-0.json'),original=read(file);
  const mutations=[record=>{record.repetition=2;},record=>{record.input.role='foreign';},record=>{record.target.request.messages[0].content='foreign';},record=>{record.target.request.max_tokens=999;},record=>{record.results[0].pass=false;},record=>{record.target_generation='foreign';}];
  for(const mutate of mutations){
    const changed=structuredClone(original);mutate(changed);fs.writeFileSync(file,JSON.stringify(changed));
    await assert.rejects(runPreflight(options,()=>{throw new Error('Must not regenerate foreign cache');}),/Cached/);
  }
  fs.writeFileSync(file,JSON.stringify(original));
  const reportFile=path.join(options.out,'report.json'),report=read(reportFile);report.results=[];
  fs.writeFileSync(reportFile,JSON.stringify(report));
  await assert.rejects(runPreflight(options,stubTarget),/Cached report/);
});

test('empty or duplicate cases and invalid repetitions fail before snapshot or generation',async()=>{
  for(const cases of [[],[caseDefinition,caseDefinition]]){
    const options=fixture();fs.writeFileSync(options.caseFile,JSON.stringify(cases));
    await assert.rejects(runPreflight(options,stubTarget),/nonempty with unique/);
    assert.equal(fs.existsSync(options.out),false);
  }
  for(const repetitions of [0,-1,1.5]){
    const options=fixture();fs.writeFileSync(options.settingsFile,JSON.stringify({...settings,repetitions}));
    await assert.rejects(runPreflight(options,stubTarget),/repetitions must be/);
    assert.equal(fs.existsSync(options.out),false);
  }
});

test('completed runs with missing generation evidence reject before any provider call',async()=>{
  const options=fixture();await runPreflight(options,stubTarget);
  const file=path.join(options.out,caseDefinition.id+'-0.json');fs.renameSync(file,file+'.saved');
  let calls=0;
  await assert.rejects(runPreflight(options,(...args)=>{calls++;return stubTarget(...args);}),/Completed preflight has missing/);
  assert.equal(calls,0);assert.equal(fs.existsSync(file),false);
});

test('partial runs validate every retained record before generating any missing job',async()=>{
  const options=fixture();await runPreflight(options,stubTarget);
  for(const name of ['report.json','preflight.json',caseDefinition.id+'-0.json']){
    const file=path.join(options.out,name);fs.renameSync(file,file+'.saved');
  }
  const file=path.join(options.out,caseDefinition.id+'-2.json'),record=read(file);
  record.target_generation='foreign';fs.writeFileSync(file,JSON.stringify(record));
  let calls=0;
  await assert.rejects(runPreflight(options,(...args)=>{calls++;return stubTarget(...args);}),/Cached generation identity/);
  assert.equal(calls,0);assert.equal(fs.existsSync(path.join(options.out,caseDefinition.id+'-0.json')),false);
});

test('product fallback generation is included in the frozen source dependencies',async()=>{
  const options=fixture(),withoutBase={...caseDefinition};delete withoutBase.baseline_system;
  fs.writeFileSync(options.caseFile,JSON.stringify([withoutBase]));
  await runPreflight({...options,regenerateRoomPrompt:false},stubTarget);
  const snapshot=read(path.join(options.out,'snapshot.json'));
  assert.ok(snapshot.dependencies.some(item=>item.file==='tutor-system/src/services/prompts/index.ts'));
  assert.ok(snapshot.dependencies.some(item=>item.file==='tutor-system/src/services/prompts/responsePolicy.ts'));
});

test('real product generation and strict runner replay preserve valid, repaired and failed targets',async(t)=>{
  const originalKey=process.env.OAI_API_KEY,originalBase=process.env.OAI_BASE_URL;
  process.env.OAI_API_KEY='offline-test-key';process.env.OAI_BASE_URL='https://offline.invalid/v1';
  t.after(()=>{if(originalKey===undefined)delete process.env.OAI_API_KEY;else process.env.OAI_API_KEY=originalKey;if(originalBase===undefined)delete process.env.OAI_BASE_URL;else process.env.OAI_BASE_URL=originalBase;});
  const valid=JSON.stringify({reason:'Evidence supports this next step.',decision:{mode:'tutoring',instruction:'explanation'},response:'Review the supplied evidence.'});
  for(const responses of [[valid],['invalid',valid],['invalid','{"reason":"missing fields"}']]){
    const options=fixture();
    const c={...caseDefinition,legacy:[],expected:{...caseDefinition.expected,checks:['contract_validity','mode_selection','response_length']}};
    fs.writeFileSync(options.caseFile,JSON.stringify([c]));
    fs.writeFileSync(options.settingsFile,JSON.stringify({...settings,repetitions:1}));
    let calls=0;
    const mock=t.mock.method(globalThis,'fetch',async()=>{
      assert.ok(calls<responses.length,'Replay must not make new target calls');
      const content=responses[calls++];
      return new Response(JSON.stringify({id:'offline-'+calls,choices:[{finish_reason:'stop',message:{content}}]}),{status:200});
    });
    await runPreflight(options);
    assert.equal(calls,responses.length);
    await runPreflight(options);
    assert.equal(calls,responses.length);
    const before=read(path.join(options.out,c.id+'-0.json'));
    const report=await run({cases:options.caseFile,policy:options.policyFile,settings:options.settingsFile,variant:'product',contract_version:'v2',regenerate_room_prompt:'true',out:path.join(path.dirname(options.out),'replay'),replay:options.out,workers:1});
    assert.equal(calls,responses.length);assert.deepEqual(report.results[0].target,before.target);assert.deepEqual(report.results[0].new_target_calls,[]);
    if(responses.length===2)assert.ok(before.target.format_repair);
    if(responses.at(-1)!==valid)assert.ok(report.results[0].target.error);
    mock.mock.restore();
  }
});
