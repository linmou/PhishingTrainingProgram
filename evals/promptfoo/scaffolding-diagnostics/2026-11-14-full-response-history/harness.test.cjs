#!/usr/bin/env node
// Tests run.cjs request packaging: preserve actual structured history, keep judge blind to model metadata, and retain every paired slot.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { messagesFor, judgedCase, judgeMessages, load } = require('./run.cjs');
const s = load(), c = s.cases[0];
const first = { parsed: { reason: 'PRIVATE_ANALYSIS', decision: { guard_mode: false, instruction: 'scaffolding' }, response: 'A posted tutor question.' }, error: null };
const payload = messages => JSON.parse(messages[1].content.split('\n').at(-1));
test('candidate carries complete previous contract while baseline carries posted response only', () => {
  const a = payload(messagesFor(s, c, 'baseline', 2, first)), b = payload(messagesFor(s, c, 'full_history', 2, first));
  assert(b.conversation_history.includes(JSON.stringify(first.parsed)));
  assert(!a.conversation_history.includes('PRIVATE_ANALYSIS'));
  assert.equal(b.student_message, a.student_message);
  assert.equal(b.conversation_history.replace(JSON.stringify(first.parsed), first.parsed.response), a.conversation_history);
});
test('judgment gets actual posted dialogue and no private metadata', () => {
  const context = judgedCase(s, c, 2, first);
  const request = judgeMessages(s, context, first.parsed, s.metrics[0]);
  assert(!JSON.stringify(request).includes('PRIVATE_ANALYSIS'));
  assert(context.input.conversation_history.includes(first.parsed.response));
  assert.equal(context.input.student_message, 'Okay.');
});
test('invalid first generation blocks dependent history instead of substituting a response', () => {
  assert.throws(() => messagesFor(s, c, 'full_history', 2, { error: 'invalid' }), /Previous turn unavailable/);
});
test('case repetition turn manifest contains every planned slot', () => {
  assert.equal(s.cases.length * 2 * s.repetitions.length * s.turns.length, 72);
  assert.equal(s.calibration.length, 16);
  assert.equal(s.metrics.length, 3);
});
