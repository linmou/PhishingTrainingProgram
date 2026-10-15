#!/usr/bin/env node
// Purpose: verify product-adapter.js preserves production context, isolates the policy intervention, and rejects truncated decisions.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productionMessages, productionRepair, productionValid } = require('./product-adapter');
const cases = require('./development-with-guard-scenario-rich.json');
const { buildEcologicalChatCompletionMessages } = require('../../../tutor-system/src/services/ecologicalTutorCall.ts');
const { ACTIVE_TUTOR_AGENT_PROMPT } = require('../../../tutor-system/src/services/prompts/activeTutorAgentPrompt.ts');
const { generateSystemPrompt, PRESET_CONFIGS } = require('../../../tutor-system/src/services/systemPrompts.ts');

test('all development requests match production and hide evaluator annotations', () => {
  for (const definition of cases) {
    const actual = productionMessages(definition, '');
    assert.deepEqual(actual, buildEcologicalChatCompletionMessages(definition.baseline_system, definition.input));
    assert.equal(actual.some(message => message.content.includes('knowledge_required')), false);
    assert.equal(actual.some(message => message.content.includes('expected_instruction')), false);
    const changed = productionMessages(definition, 'Candidate policy.');
    assert.equal(changed[1].content, actual[1].content);
    assert.equal(changed[0].content, actual[0].content.slice(0, -ACTIVE_TUTOR_AGENT_PROMPT.length) + 'Candidate policy.');
  }
});

test('explicit regeneration uses current room configuration while baseline retains its saved prompt', () => {
  for (const definition of cases) {
    const saved = { ...definition, baseline_system: 'Frozen previous room prompt.' };
    const generatedRoom = generateSystemPrompt({ ...PRESET_CONFIGS.casual_peer, role: { role: definition.role === 'adult' ? 'high' : 'low' }, ...definition.inventory });
    const expected = buildEcologicalChatCompletionMessages(generatedRoom, definition.input);
    const actual = productionMessages(saved, 'Candidate policy.', true);
    assert.equal(actual[1].content, expected[1].content);
    assert.equal(actual[0].content, expected[0].content.slice(0, -ACTIVE_TUTOR_AGENT_PROMPT.length) + 'Candidate policy.');
    assert(productionMessages(saved, '')[0].content.startsWith(saved.baseline_system));
  }
});

test('format repair appends the production instruction without supplying failed answers', () => {
  const before = productionMessages(cases[0], '');
  const after = productionRepair(before);
  assert.equal(after.length, before.length);
  assert.deepEqual(after[0], before[0]);
  assert.ok(after[1].content.startsWith(before[1].content + '\n\n'));
  assert.match(after[1].content, /Return exactly one valid JSON object/);
});

test('production validity rejects missing decisions and truncation even for parseable text', () => {
  const text = JSON.stringify({ reason: 'Evidence.', decision: { mode: 'tutoring', instruction: 'explanation' }, response: 'Check independently.' });
  assert.equal(productionValid({ text, payload: { choices: [{ finish_reason: 'stop' }] } }), true);
  assert.equal(productionValid({ text, payload: { choices: [{ finish_reason: 'length' }] } }), false);
  assert.equal(productionValid({ text: '{}' }), false);
});

test('replaying a failed format repair preserves its failure without another generation', async () => {
  const { generateTarget } = require('./runner');
  const messages = productionMessages(cases[0], '');
  const replay = { request: { messages }, text: '{}', payload: { choices: [{ finish_reason: 'length' }] }, format_repair: { initial: { request: { messages } } } };
  const result = await generateTarget(messages, 'product', { target_format_attempts: 2, transport_attempts: 3 }, replay, 'v2');
  assert.ok(result.target.error);
  assert.equal(result.target.text, '{}');
  assert.deepEqual(result.calls, []);
});

// Covers runner.js: all v2 variants must use production parsing, truncation rejection and the same bounded repair.
test('lean v2 generation applies production validity and repair to every malformed output', async (t) => {
  const {generateTarget}=require('./runner');
  const beforeKey=process.env.OAI_API_KEY,beforeBase=process.env.OAI_BASE_URL;
  process.env.OAI_API_KEY='offline-test-key';process.env.OAI_BASE_URL='https://offline.invalid/v1';
  t.after(()=>{if(beforeKey===undefined)delete process.env.OAI_API_KEY;else process.env.OAI_API_KEY=beforeKey;if(beforeBase===undefined)delete process.env.OAI_BASE_URL;else process.env.OAI_BASE_URL=beforeBase;});
  const object={reason:'Evidence.',decision:{mode:'tutoring',instruction:'explanation'},response:'A response.'};
  const messages=[{role:'system',content:'Policy.'},{role:'user',content:'Context.'}];
  const settings={model:'offline',target_temperature:0.3,target_max_tokens:100,target_enable_thinking:false,target_format_attempts:2,transport_attempts:1,timeout_ms:1000};
  for(const first of [{text:JSON.stringify(object),finish:'length'},{text:JSON.stringify({...object,reasoning:'Legacy field.'}),finish:'stop'},{text:JSON.stringify({...object,response:'[agent:tutor] A response.'}),finish:'stop'}]){
    assert.equal(productionValid({text:first.text,payload:{choices:[{finish_reason:first.finish}]}}),false);
    const requests=[];
    const mock=t.mock.method(globalThis,'fetch',async(url,options)=>{
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({id:'offline-'+requests.length,choices:[{finish_reason:requests.length===1?first.finish:'stop',message:{content:requests.length===1?first.text:JSON.stringify(object)}}]}),{status:200});
    });
    const result=await generateTarget(messages,'candidate',settings,undefined,'v2');
    assert.equal(result.calls.length,2);assert.ok(result.target.format_repair);
    assert.deepEqual(requests[1].messages,productionRepair(messages));
    assert.equal(productionValid(result.target),true);
    mock.mock.restore();
  }
  const replay={request:{messages},text:'{}',payload:{choices:[{finish_reason:'stop'}]},format_repair:{initial:{request:{messages}}}};
  const result=await generateTarget(messages,'candidate',settings,replay,'v2');
  assert.ok(result.target.error);assert.deepEqual(result.calls,[]);
});
