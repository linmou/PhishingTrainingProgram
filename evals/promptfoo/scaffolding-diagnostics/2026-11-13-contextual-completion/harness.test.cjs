#!/usr/bin/env node
// Purpose: verify runner.cjs rejects malformed judge records and isolates learner-facing output for one metric per judgment.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { parseJudge, judgeMessages } = require('./runner.cjs');
test('judge validation preserves booleans and rejects absent, malformed or truncated evidence', () => {
  const value = { required_meanings: 'task', learner_evidence: ['quoted learner'], remaining_task: 'none', response_action: { action: 'advance' }, reason: 'quoted evidence', pass: true };
  assert.equal(parseJudge({ text: JSON.stringify(value) }).result.pass, true);
  for (const changed of [{ pass: 'true' }, { reason: '' }, { learner_evidence: [] }, { response_action: {} }]) assert(parseJudge({ text: JSON.stringify({ ...value, ...changed }) }).error);
  assert(parseJudge({ error: 'HTTP 503' }).error);
  assert(parseJudge({ text: JSON.stringify(value), payload: { choices: [{ finish_reason: 'length' }] } }).error);
});
test('one rubric and learner response enter judgment without private tutor rationale', () => {
  const s = { judgeSystem: 'system', rubrics: { a: 'rubric A', b: 'rubric B' } }, c = { input: { scenario_context: 'scenario', conversation_history: 'history', student_message: 'answer' }, inventory: {}, reference: {} };
  const messages = judgeMessages(s, c, { response: 'shown', reason: 'private rationale' }, 'a'), body = JSON.parse(messages[1].content);
  assert.equal(body.rubric, 'rubric A'); assert.equal(body.response, 'shown'); assert(!messages[1].content.includes('private rationale')); assert(!messages[1].content.includes('rubric B'));
});
