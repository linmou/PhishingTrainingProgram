#!/usr/bin/env node
// Purpose: verify runner.cjs preserves task/heading payloads and target isolation, validates judge structure, and constructs honest completion controls.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { labels, transform, withInput, parseJudge, judgeMessages, judgeSettings, workerCount, assertTargetReuse, settings } = require('./runner.cjs');
const { loadFrozen } = require('./frozen-evidence.cjs');
test('label transformation retains complete headings and both payloads in every occurrence', () => {
  const item = 'Knowledge Point 3: Do not share your schedule. (Harder)\nWhat to notice: A time and place.\nWhat to do: Arrange plans privately.';
  const source = [{ role: 'system', content: item + '\nCURRENT LEARNING PROGRESS\n' + item + ': pending' }, { role: 'user', content: 'learner text' }];
  const result = transform(source, 'labels', 'policy');
  assert.equal(result[0].content, labels(source[0].content)); assert.equal(result[1].content, source[1].content);
  assert.equal(result[0].content.split(item.split('\n')[0]).length, 3);
  assert.equal(result[0].content.replaceAll('Observation task:', 'What to notice:').replaceAll('Behavior task:', 'What to do:'), source[0].content);
  assert.deepEqual(transform(source, 'current', 'policy'), source);
  assert.equal(transform(source, 'sequence', 'policy')[0].content, result[0].content + '\n\npolicy');
});
test('trajectory input replacement retains prior actual tutor text and schema', () => {
  const original = [{ role: 'system', content: 'system' }, { role: 'user', content: 'Draft\n' + JSON.stringify({ scenario_context: 'post', conversation_history: 'old', student_message: 'old', interaction_mode: 'single_agent' }) }];
  const result = withInput(original, { conversation_history: 'actual tutor\nactual learner', student_message: 'actual learner' });
  assert.equal(result[0].content, 'system'); assert.deepEqual(JSON.parse(result[1].content.slice(6)), { scenario_context: 'post', conversation_history: 'actual tutor\nactual learner', student_message: 'actual learner', interaction_mode: 'single_agent' });
});
test('judge rejects malformed verdicts and truncated replies without semantic guessing', () => {
  assert.equal(parseJudge({ text: '{"current_point":"point","learner_evidence":"none","reply_components":"observation","pass":true,"reason":"supported","evidence":"quote"}' }).result.pass, true);
  for (const text of ['{}', '{"pass":"true","reason":"x","evidence":"x"}', '{"pass":false,"reason":"","evidence":"x"}', 'not json']) assert(parseJudge({ text }).error);
  assert(parseJudge({ error: 'provider unavailable' }).error);
  const v = { current_point: 'point', learner_evidence: 'none', reply_components: [{ clause: 'words', component: 'recognition' }], reason: 'supported', evidence: 'quote', pass: true };
  assert.equal(parseJudge({ text: JSON.stringify(v) }).result.pass, true);
  for (const value of [[], [{}], [null], { clause: '' }]) assert(parseJudge({ text: JSON.stringify({ ...v, reply_components: value }) }).error);
  assert(parseJudge({ text: '{"pass":true,"reason":"x","evidence":"x"}', payload: { choices: [{ finish_reason: 'length' }] } }).error);
});
test('single-metric judge receives no private tutor rationale or other rubric', () => {
  const s = { judge_system: 'judge', judge_steps: { a: 'steps a', b: 'steps b' }, rubrics: { a: 'rubric a', b: 'rubric b' } }, c = { input: { scenario_context: 'post', conversation_history: 'history', student_message: 'reply' }, inventory: [], reference: { component: 'action' } };
  const messages = judgeMessages(s, c, { reason: 'private secret', decision: {}, response: 'shown' }, 'a');
  const body = JSON.parse(messages[1].content); assert.equal(body.rubric, 'rubric a'); assert.equal(body.evidence.response, 'shown'); assert(!messages[1].content.includes('private secret')); assert(!messages[1].content.includes('rubric b'));
});
test('completion pair changes only final reply after common learner recognition and question', () => {
  const { snapshot } = loadFrozen();
  const [original, unfinished, completed] = ['room_unanswered_original', 'room_completion_unfinished', 'room_completion_completed'].map(id => snapshot.cases.find(c => c.id === id));
  const prefix = c => c.input.conversation_history.slice(0, -c.input.student_message.length);
  assert.equal(prefix(unfinished), prefix(completed)); assert.deepEqual(unfinished.inventory, completed.inventory);
  assert.equal(original.reference.component, 'recognition'); assert.equal(unfinished.reference.component, 'action'); assert.equal(completed.reference.component, 'next');
  assert.equal(unfinished.provenance.holdout_eligible, false);
});
test('all judge metrics use thinking while tutor remains nonthinking', () => {
  for (const metric of ['recognition_before_action', 'responsive_progression', 'component_disclosure']) assert.deepEqual(judgeSettings(metric), { judge_enable_thinking: true, judge_max_tokens: 8000 });
  assert.equal(require('./runner.cjs').settings.target_enable_thinking, false);
});
test('worker limit accepts user-requested32 and rejects33 and invalid counts', () => {
  assert.equal(workerCount('32'), 32); assert.equal(workerCount('16'), 16); assert.equal(workerCount(1), 1);
  for (const n of [0, 33, 1.5, 'bad']) assert.throws(() => workerCount(n));
});
test('target reuse requires exact request and settings, including thinking', () => {
  const messages = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], job = { messages };
  const record = { messages, attempts: [{ request: { messages, model: settings.model, temperature: 0.3, max_tokens: 600, enable_thinking: false } }] };
  assertTargetReuse(record, job);
  for (const change of [{ model: 'other' }, { enable_thinking: true }, { temperature: 0 }, { max_tokens: 800 }]) { const changed = structuredClone(record); Object.assign(changed.attempts[0].request, change); assert.throws(() => assertTargetReuse(changed, job)); }
  assert.throws(() => assertTargetReuse(record, { messages: [{ role: 'user', content: 'different' }] }));
});
