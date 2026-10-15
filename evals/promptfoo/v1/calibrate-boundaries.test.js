#!/usr/bin/env node
// Tests calibrate-boundaries.js: preserve calibration labels and reject missing, malformed, or inaccurate judgments.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { grade, assemble, requestFor } = require('./calibrate-boundaries');
const proposal = require('../refinement-20261014/evaluator-boundary-calibration-proposal.json');

test('all original fixture inputs and labels assemble; altered labels fail closed', () => {
  assert.equal(assemble(proposal).length, 81);
  const altered = structuredClone(proposal);
  altered.regression_fixtures[0].expected.pass = !altered.regression_fixtures[0].expected.pass;
  assert.throws(() => assemble(altered), /label changed/);
});
test('missing and transport failures never agree with a negative label', () => {
  const fixture = { metric: 'persona_stability', expected: { status: 'fail', pass: false } };
  assert.equal(grade({ text: '{}' }, fixture).agrees, false);
  assert.equal(grade({ error: 'timeout', text: '{"persona_stability":{"pass":false,"score":0,"reason":"evidence"}}' }, fixture).agrees, false);
});
test('conditional accuracy and inapplicability labels are preserved', () => {
  const fixture = { metric: 'contextual_knowledge_quality', expected: { status: 'fail', pass: false, accuracy_pass: false } };
  assert.equal(grade({ text: '{"contextual_knowledge_quality":{"pass":false,"score":0,"reason":"evidence","accuracy_pass":true}}' }, fixture).agrees, false);
  const na = { ...fixture, expected: { status: 'not_applicable', pass: null, accuracy_pass: null } };
  assert.equal(grade({ text: '{"contextual_knowledge_quality":{"applicable":false,"pass":null,"score":null,"reason":"evidence","accuracy_pass":null}}' }, na).agrees, true);
});
test('judge request identity includes every generation setting', () => {
  const settings = { model: 'model', judge_temperature: 0, judge_max_tokens: 8000, judge_enable_thinking: true };
  const a = requestFor([], settings), b = requestFor([], { ...settings, judge_enable_thinking: false });
  assert.notDeepEqual(a, b);
  assert.deepEqual(a.response_format, { type: 'json_object' });
});
