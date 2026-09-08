#!/usr/bin/env node
// Purpose: verify simulated/run.js preserves room data, generated history, state, privacy, error visibility and resumable Promptfoo multi-turn execution.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildTurn, runConversation } = require('./run');
const { loadApiProvider } = require('../../../../tutor-system/node_modules/promptfoo/dist/src/index.cjs');
const seed = { role: 'peer', inventory: { detection_areas: ['pressure'], verification_steps: ['open real app'] },
  input: { scenario_context: 'Room with an account alert', conversation_history: 'Tutor: Look at the alert.', student_message: 'I refuse to learn.', prior_mode: null } };

test('rejects dropped, changed and reordered generated history', () => {
  const previous = [{ input: seed.input, parsed: { response: 'Make an attempt.', decision: { mode: 'guard' } } }];
  const messages = [{role:'user',content:seed.input.student_message},{role:'assistant',content:'Make an attempt.'},{role:'user',content:'Okay'}];
  const turn = buildTurn(seed, messages, previous);
  assert.equal(turn.input.prior_mode, 'guard');
  assert.equal(turn.input.scenario_context, seed.input.scenario_context);
  assert.equal(turn.input.conversation_history, 'Tutor: Look at the alert.\nStudent: I refuse to learn.\nTutor: Make an attempt.');
  assert.throws(() => buildTurn(seed, messages.slice(2), previous), /Missing/);
  assert.throws(() => buildTurn(seed, [{...messages[0],content:'Changed'},...messages.slice(1)], previous), /history changed/);
  assert.throws(() => buildTurn(seed, [messages[0],{...messages[1],content:'Changed'},messages[2]], previous), /reply missing/);
});

test('real Promptfoo simulator replays all three turns, hides supervisor fields and resumes without model calls', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-simulated-context-'));
  let targetCalls = 0, learnerCalls = 0;
  const modes = ['guard','guard','tutoring'];
  const generate = async messages => {
    const input = JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));
    assert.equal(input.scenario_context, seed.input.scenario_context);
    assert(messages[0].content.includes(JSON.stringify(seed.inventory)));
    if(targetCalls > 0) assert(input.conversation_history.includes(`Tutor: Reply ${targetCalls}.`));
    assert.equal(input.prior_mode, targetCalls ? modes[targetCalls-1] : null);
    const index = targetCalls++;
    return { target: { text: JSON.stringify({reason:'PRIVATE_SUPERVISOR_EVIDENCE',decision:{mode:modes[index],instruction:index===2?'scaffolding':null},response:`Reply ${index+1}.`}) } };
  };
  const call = async messages => {
    assert(!JSON.stringify(messages).includes('PRIVATE_SUPERVISOR_EVIDENCE'));
    learnerCalls++;
    const evidence = JSON.parse(messages[1].content);
    assert.equal(evidence.room, seed.input.scenario_context);
    assert.equal(evidence.initial_history, seed.input.conversation_history);
    assert.equal(evidence.conversation.at(-1).content, `Reply ${learnerCalls}.`);
    return {text:JSON.stringify({message:learnerCalls===1?'Okay':'Which name should I check?'})};
  };
  const args = { definition:{instructions:'PRIVATE_SIMULATOR_INTENT'}, seed, policy:'Frozen candidate policy', settings:{},directory,maxTurns:3,rubrics:{},loadProvider:loadApiProvider,generate,call };
  const first = await runConversation(args);
  assert.equal(first.turns,3);
  assert.equal(targetCalls,3);
  assert.equal(learnerCalls,2);
  assert.deepEqual(first.deterministic,{method:'deterministic',context_preserved:true,contract_valid:true,response_length:true});
  const record = JSON.parse(fs.readFileSync(path.join(directory,'turn-3.json')));
  assert(!JSON.stringify(record.messages).includes('PRIVATE_SIMULATOR_INTENT'));
  const again = await runConversation({...args,generate:async()=>{throw Error('Unexpected target call');},call:async()=>{throw Error('Unexpected learner call');}});
  assert.equal(again.turns,3);
});

test('invalid target contract stays an explicit incomplete trajectory', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'tutor-simulated-error-'));
  const result = await runConversation({definition:{instructions:'learner'},seed,policy:'policy',settings:{},directory,maxTurns:3,rubrics:{},loadProvider:loadApiProvider,
    generate:async()=>({target:{text:'not JSON'}}),call:async()=>{throw Error('Learner must not run after target error');}});
  assert(result.error);
  assert.equal(result.turns,0);
  assert(fs.existsSync(path.join(directory,'turn-1.json')));
});
