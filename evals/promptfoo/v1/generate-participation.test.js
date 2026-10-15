#!/usr/bin/env node
// Tests generate-participation.js: classify only valid stage objects and keep evaluator labels outside requests.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { parsedMode, messagesFor } = require('./generate-participation');
test('stage parser rejects errors, truncation, missing reason, invalid mode and wrong order', () => {
  const valid = { text: '{"reason":"Evidence","mode":"guard"}' };
  assert.equal(parsedMode(valid).mode, 'guard');
  for (const raw of [{ ...valid, error: 'timeout' }, { ...valid, payload: { choices: [{ finish_reason: 'length' }] } },
    { text: '{"mode":"guard","reason":"Evidence"}' }, { text: '{"reason":"","mode":"guard"}' }, { text: '{"reason":"Evidence","mode":"other"}' }]) assert.equal(parsedMode(raw), null);
});
test('target messages contain supplied evidence, not expected decisions or case identity', () => {
  const c = { id: 'PRIVATE_CASE', expected: { mode: 'PRIVATE_LABEL' }, input: { student_message: 'input', prior_mode: 'unknown' }, inventory: { detection_areas: ['target'] } };
  const messages = messagesFor(c, 'policy');
  assert.deepEqual(JSON.parse(messages[1].content), { ...c.input, knowledge_inventory: c.inventory });
  assert.equal(JSON.stringify(messages).includes('PRIVATE_'), false);
});
