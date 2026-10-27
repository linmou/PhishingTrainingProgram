'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSavedResult } = require('./assessment-result-checks');
const reviewed = { correct_option_ids: ['B'], learner_safe_explanation: 'Use an independent channel.' };
const row = (outcome, attempt, content) => ({ content, parent_message_id: 'answer', assessment_event: {
  kind: 'result', outcome, attempt_number: attempt, terminal: outcome !== 'retry', answer_message_id: 'answer'
} });
test('retry and either pass keep the key/explanation private; only terminal failure discloses reviewed material', () => {
  assertSavedResult(row('retry', 1, 'Incorrect. One attempt remaining.'), 'retry', 1, reviewed);
  for (const attempt of [1, 2]) assertSavedResult(row('passed', attempt, 'Correct.'), 'passed', attempt, reviewed);
  assertSavedResult(row('failed', 2, 'Incorrect. No attempts remaining. Correct option(s): B.\nUse an independent channel.'), 'failed', 2, reviewed);
});
test('rejects early disclosure, invented explanation, nested private metadata, or wrong answer binding', () => {
  for (const bad of [
    row('retry', 1, 'Incorrect. Correct answer: B.'),
    { ...row('retry', 1, 'Incorrect. One attempt remaining.'), nested: { transfer_basis: {} } },
    { ...row('retry', 1, 'Incorrect. One attempt remaining.'), parent_message_id: 'question' }
  ]) assert.throws(() => assertSavedResult(bad, 'retry', 1, reviewed));
  assert.throws(() => assertSavedResult(row('failed', 1, 'anything'), 'failed', 1, reviewed));
  assert.throws(() => assertSavedResult(row('failed', 2, 'Incorrect. No attempts remaining. Correct option(s): B.\nInvented'), 'failed', 2, reviewed));
});
