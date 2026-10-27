// Capture/scanner logic only: local fixtures do not establish hosted privacy acceptance.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { inspectLearnerData, captureLearnerData } = require('./assessment-privacy-checks');
const privacy = require('./assessment-privacy');
const { selectWorkflows } = require('../../browser-e2e');
const secret = 'private-explanation-canary';
const privateValues = [{ label: 'safe_explanation', value: secret }, { label: 'basis', value: 'private-basis-canary' }];
const event = { kind: 'result', assessment_id: 'assessment', question_message_id: 'question', outcome: 'failed', attempt_number: 2, terminal: true };
const result = { id: 'trusted-result', content: `Incorrect. No attempts remaining. Correct option(s): B.\n${secret}`, assessment_event: event };
const options = { privateValues, approvedResults: [result] };

test('privacy workflow is opt-in and rejects production before fixture use', async () => {
  assert(!selectWorkflows([]).includes('assessment-privacy'));
  assert.deepEqual(selectWorkflows(['--workflow=assessment-privacy']), ['assessment-privacy']);
  await assert.rejects(privacy({ config: { projectRef: 'production' } }), /staging-only/);
});
test('detects private fields, renamed private values and encoded JSON without storing values in findings', () => {
  for (const surface of ['network', 'realtime', 'export_json', 'export_txt', 'dom', 'error']) {
    const findings = inspectLearnerData({ renamed: ['private-basis-canary'], more: { raw_provider_output: 'data' } }, { ...options, surface });
    assert(findings.some(row => row.kind === 'private_value'));
    assert(findings.some(row => row.kind === 'private_field'));
    assert(!JSON.stringify(findings).includes('private-basis-canary'));
  }
  assert(inspectLearnerData({ text: JSON.stringify({ correct_option_ids: ['B'] }) }).length > 0);
  const keyLeak = inspectLearnerData({ 'private-basis-canary': 'renamed' }, options);
  assert(keyLeak.length > 0); assert(!JSON.stringify(keyLeak).includes('private-basis-canary'));
});
test('only a persisted, exact second-failure result can authorize terminal disclosure', () => {
  assert.deepEqual(inspectLearnerData(result, options), []);
  assert(inspectLearnerData(result, { privateValues }).length > 0);
  for (const changed of [{ ...result, id: 'forged' }, { ...result, content: secret },
    { ...result, assessment_event: { ...event, attempt_number: 1 } },
    { ...result, assessment_event: { ...event, outcome: 'passed' } }]) {
    assert(inspectLearnerData(changed, options).length > 0);
  }
  const feedback = { assessment_id: 'assessment', answer_outcome: 'failed', attempts_used: 2, terminal: true,
    result_message: result, terminal_failure_feedback: { correct_option_ids: ['B'], learner_safe_explanation: secret } };
  assert.deepEqual(inspectLearnerData(feedback, options), []);
  assert(inspectLearnerData({ ...feedback, assessment_id: 'other' }, options).length > 0);
  assert(inspectLearnerData({ ...feedback, terminal_failure_feedback: { ...feedback.terminal_failure_feedback, rationale: 'private' } }, options).length > 0);
  assert(inspectLearnerData({ ...feedback, attempts_used: 1 }, options).length > 0);
});
test('terminal text in DOM/exports is allowed exactly; identical private material in errors stays forbidden', () => {
  assert.deepEqual(inspectLearnerData('Assessment result\n' + result.content, { ...options, surface: 'dom' }), []);
  assert.deepEqual(inspectLearnerData('History\n' + result.content, { ...options, surface: 'export_txt' }), []);
  assert(inspectLearnerData(result.content, { ...options, surface: 'error' }).length > 0);
  assert(inspectLearnerData(result.content + '\nextra ' + secret, { ...options, surface: 'export_txt' }).length > 0);
});
test('collector captures GET/POST/error bodies and real row frames; heartbeats cannot count as row evidence', async () => {
  const page = new EventEmitter(); const socket = new EventEmitter(); socket.url = () => 'wss://stage.invalid/realtime/v1/websocket';
  const capture = captureLearnerData(page, 'https://stage.invalid');
  page.emit('websocket', socket);
  socket.emit('framereceived', { payload: JSON.stringify([null, null, 'topic', 'heartbeat', { record: { id: 'row' }, text: 'postgres_changes' }]) });
  assert.equal(capture.hasRealtimeRow('row'), false);
  socket.emit('framereceived', { payload: JSON.stringify([null, null, 'topic', 'postgres_changes', { data: { table: 'messages', type: 'INSERT', record: { id: 'row', content: 'public' } } }]) });
  assert.equal(capture.hasRealtimeRow('row'), true);
  for (const [method, status] of [['GET', 200], ['POST', 403]]) page.emit('response', {
    url: () => 'https://stage.invalid/rest/v1/messages', status: () => status,
    request: () => ({ method: () => method }), text: async () => JSON.stringify({ content: 'public' })
  });
  const records = await capture.checkpoint(options);
  assert(records.some(row => row.surface === 'network'));
  assert(records.some(row => row.surface === 'error'));
  assert(records.some(row => row.surface === 'realtime'));
  assert(records.every(row => row.violations.length === 0 && row.sha256));
  capture.stop();
  assert.equal(page.listenerCount('response'), 0); assert.equal(socket.listenerCount('framereceived'), 0);
});
test('unreadable HTTP or realtime bodies fail capture instead of silently passing privacy', async () => {
  const page = new EventEmitter(); const capture = captureLearnerData(page, 'https://stage.invalid');
  page.emit('response', { url: () => 'https://stage.invalid/functions/v1/assessment-api', status: () => 200,
    request: () => ({ method: () => 'POST' }), text: async () => { throw new Error('body unavailable'); } });
  await assert.rejects(capture.checkpoint(options), /could not be captured/); capture.stop();
});


test('legacy export explanation requires the same privately verified second-failure lifecycle', () => {
  const question = { id: 'question', public_question: { id: 'assessment' }, answer_lifecycle: {
    assessment_id: 'assessment', state: 'failed', answer_outcome: 'failed', terminal: true,
    attempt_number: 2, attempts_used: 2, attempts_remaining: 0, terminal_explanation: secret
  } };
  const exported = { ...options, surface: 'export_json' };
  assert.deepEqual(inspectLearnerData(question, exported), []);
  assert(inspectLearnerData({ ...question, id: 'wrong-question' }, exported).length > 0);
  assert(inspectLearnerData(question, { ...exported, surface: 'error' }).length > 0);
  assert.deepEqual(inspectLearnerData(`Final answer: incorrect.\nExplanation: ${secret}`, { ...options, surface: 'export_txt' }), []);
});
