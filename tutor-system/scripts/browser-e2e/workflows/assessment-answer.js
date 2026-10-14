#!/usr/bin/env node
// Purpose: verify learner pass, retry, failure, persistence, and reload in staging.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, query, waitForMatch, captureResponses, managementQuery, screenshot, writeJson, TIMEOUT } = require('../browser-e2e-support');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');
const { assertAssessmentGate, assertBlockedOrdinaryReply, assertBoundAnswers } = require('./assessment-browser-checks');

async function answer(ctx, label, selections, expectedStatus) {
  const fixture = await assessmentRoom({ ...ctx, kind: `assessment-answer-${label}` });
  const delivered = await deliverFixedAssessment(ctx, fixture);
  const priorMessageIds = (await query(ctx.client, 'messages', 'id', 'room_id', fixture.room.id)).map(row => row.id);
  await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
  const question = ctx.studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
  await question.waitFor({ timeout: TIMEOUT });
  const inputGates = [await assertBlockedOrdinaryReply(ctx, fixture.room.id)];
  assert.equal(await question.getByRole('button', { name: 'Submit answer' }).isDisabled(), true,
    'Assessment accepted an empty selection');
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  await question.waitFor({ timeout: TIMEOUT });
  inputGates.push(await assertAssessmentGate(ctx.studentPage, true));
  const stop = await captureResponses(ctx.studentPage, (response) => response.url().includes('/functions/v1/assessment-api'));
  let calls;
  try {
    for (const [index, selected] of selections.entries()) {
      await question.locator(`input[value="${selected}"]`).check();
      await question.getByRole('button', { name: 'Submit answer' }).click();
      const status = selected === 'B' ? 'Correct.' : expectedStatus === 'failed' && index === selections.length - 1 ? 'Correct option(s):' : 'Incorrect.';
      await question.getByRole('status').filter({ hasText: status }).waitFor({ timeout: TIMEOUT });
      if (index < selections.length - 1) {
        inputGates.push(await assertBlockedOrdinaryReply(ctx, fixture.room.id));
        await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
        await question.getByRole('status').filter({ hasText: 'Incorrect.' }).waitFor({ timeout: TIMEOUT });
        inputGates.push(await assertAssessmentGate(ctx.studentPage, true));
      }
    }
  } finally { calls = await stop(); }
  writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-function.json`), calls);
  assert(calls.some((call) => call.request?.operation === 'process_message' && call.status === 200), 'Assessment answer did not reach the trusted API');
  inputGates.push(await assertAssessmentGate(ctx.studentPage, false));
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  const restored = ctx.studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
  await restored.waitFor({ timeout: TIMEOUT });
  await restored.getByRole('status').filter({ hasText: expectedStatus === 'passed' ? 'Correct.' : 'Correct option(s):' }).waitFor({ timeout: TIMEOUT });
  assert.equal(await restored.getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
  inputGates.push(await assertAssessmentGate(ctx.studentPage, false));
  const messages = await waitForMatch(
    () => query(ctx.client, 'messages', '*', 'room_id', fixture.room.id),
    (rows) => rows.some((row) => row.assessment_result === (expectedStatus === 'passed' ? 'pass' : 'fail')),
    `${label} persisted assessment result`
  );
  const privateRows = await managementQuery(ctx.config,
    `select id,lifecycle,terminal_result,attempt_count from private.transfer_assessments where id = '${delivered.assessment_id}'::uuid`);
  writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-persisted.json`), { messages, private_assessment: privateRows });
  assert(privateRows.some((row) => row.terminal_result === expectedStatus && row.attempt_count === selections.length),
    'Private assessment result or attempt count does not match the learner answers');
  const answers = assertBoundAnswers(messages, ctx.student.id, delivered.assessment_id,
    delivered.question_message_id, selections.map(selected => [selected]), priorMessageIds);
  const attempts = await managementQuery(ctx.config,
    `select * from private.transfer_assessment_attempts where assessment_id='${delivered.assessment_id}'::uuid order by attempt_number`);
  writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-attempts.json`), attempts);
  assert.equal(attempts.length, selections.length, 'Authoritative attempts differ from selected option submissions');
  for (const [index, attempt] of attempts.entries()) {
    assert.equal(attempt.attempt_number, index + 1);
    assert.deepEqual(attempt.selected_option_ids, [selections[index]]);
    assert(answers.some(row => row.id === attempt.answer_message_id), 'Attempt references a different learner answer');
  }
  return {
    room_id: fixture.room.id, question_message_id: delivered.question_message_id,
    assessment_id: delivered.assessment_id, selections, function_calls: calls,
    public_messages: messages, private_assessment: privateRows, private_attempts: attempts, input_gates: inputGates,
    screenshot: await screenshot(ctx.studentPage, ctx.evidenceDir, `assessment-answer-${label}`)
  };
}

module.exports = async function assessmentAnswer(ctx) {
  return {
    passed: await answer(ctx, 'pass', ['B'], 'passed'),
    failed: await answer(ctx, 'failure', ['A', 'A'], 'failed')
  };
};
