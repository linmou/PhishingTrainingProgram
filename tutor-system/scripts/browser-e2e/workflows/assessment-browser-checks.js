#!/usr/bin/env node
// Purpose: verify assessment input gates and persisted option-answer identity in browser journeys.
'use strict';

const assert = require('node:assert/strict');
const { query } = require('../browser-e2e-support');

async function assertAssessmentGate(page, gated) {
  const composer = page.locator('textarea.comment-input-field');
  await composer.waitFor();
  assert.equal(await composer.isDisabled(), gated, 'Learner composer has the wrong assessment gate');
  const replies = page.getByRole('button', { name: 'Reply', exact: true });
  assert(await replies.count() > 0, 'No generic Reply controls were checked');
  for (const reply of await replies.all()) {
    assert.equal(await reply.isDisabled(), gated, 'Generic Reply has the wrong assessment gate');
  }
  return { composer_disabled: await composer.isDisabled(), reply_count: await replies.count(), replies_disabled: gated };
}

async function assertBlockedOrdinaryReply(ctx, roomId) {
  const before = await query(ctx.client, 'messages', 'id', 'room_id', roomId);
  const gate = await assertAssessmentGate(ctx.studentPage, true);
  // A stale/programmatic form submission must also be rejected by the shared send path.
  await ctx.studentPage.locator('form.comment-input-form').evaluate(form => {
    const input = form.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, 'A');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
  });
  const after = await query(ctx.client, 'messages', 'id', 'room_id', roomId);
  assert.deepEqual(after.map(row => row.id).sort(), before.map(row => row.id).sort(),
    'Ordinary assessment reply persisted a message');
  return { ...gate, message_ids_before: before.map(row => row.id), message_ids_after: after.map(row => row.id) };
}

function assertBoundAnswers(messages, studentId, assessmentId, questionId, expectedSelections, priorMessageIds) {
  const answers = messages.filter(row => row.user_id === studentId &&
    (row.assessment_id === assessmentId || row.parent_message_id === questionId));
  assert.equal(answers.length, expectedSelections.length, 'Missing, duplicate, or unbound assessment answer');
  for (const answer of answers) {
    assert.equal(answer.assessment_id, assessmentId, 'Answer lost its assessment binding');
    assert.equal(answer.parent_message_id, questionId, 'Answer lost its question binding');
    assert(Array.isArray(answer.assessment_selected_option_ids) && answer.assessment_selected_option_ids.length > 0,
      'Answer has no selected options');
  }
  const actual = answers.map(answer => [...answer.assessment_selected_option_ids].sort().join(',')).sort();
  assert.deepEqual(actual, expectedSelections.map(ids => [...ids].sort().join(',')).sort(),
    'Persisted options differ from the learner selections');
  if (priorMessageIds) {
    const newLearnerMessages = messages.filter(row => row.user_id === studentId && !priorMessageIds.includes(row.id));
    assert.deepEqual(newLearnerMessages.map(row => row.id).sort(), answers.map(row => row.id).sort(),
      'Assessment interaction persisted ordinary or unbound learner text');
  }
  return answers;
}

async function assertFirstPassResult(page, messages, studentId, delivered, priorMessageIds) {
  const [answer] = assertBoundAnswers(messages, studentId, delivered.assessment_id,
    delivered.question_message_id, [['B']], priorMessageIds);
  const question = messages.find(row => row.id === delivered.question_message_id);
  assert.equal(question?.assessment_id, delivered.assessment_id, 'Question has the wrong assessment');
  assert.equal(question.assessment_result, 'pass', 'Question did not record a passing grade');
  assert.equal(question.assessment_lifecycle, 'passed', 'Question did not close as passed');
  assert.equal(question.assessment_answer_message_id, answer.id, 'Question closed on the wrong answer');
  const results = messages.filter(row => row.assessment_event?.kind === 'result' &&
    (row.assessment_event.assessment_id === delivered.assessment_id ||
      row.assessment_event.question_message_id === delivered.question_message_id ||
      row.assessment_event.answer_message_id === answer.id));
  assert.equal(results.length, 1, 'Missing or duplicate saved assessment result');
  const [result] = results;
  const event = result.assessment_event;
  assert.equal(event.assessment_id, delivered.assessment_id, 'Result has the wrong assessment');
  assert.equal(event.question_message_id, delivered.question_message_id, 'Result has the wrong question');
  assert.equal(event.student_id, studentId, 'Result has the wrong learner');
  assert.equal(event.answer_message_id, answer.id, 'Result has the wrong answer');
  assert.equal(result.parent_message_id, answer.id, 'Result is not attached to its answer');
  assert.equal(event.attempt_number, 1, 'Result has the wrong attempt');
  assert.equal(event.outcome, 'passed', 'Saved result is not a pass');
  assert.equal(result.content, 'Correct.', 'Saved pass result violated the deterministic contract');
  await page.getByTestId(`assessment-result-${result.id}`).waitFor();
  return { answer, result };
}

module.exports = { assertAssessmentGate, assertBlockedOrdinaryReply, assertBoundAnswers, assertFirstPassResult };
