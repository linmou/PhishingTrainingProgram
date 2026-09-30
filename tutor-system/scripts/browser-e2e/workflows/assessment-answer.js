#!/usr/bin/env node
// Purpose: verify learner pass, retry, failure, persistence, and reload in staging.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, query, waitForMatch, captureResponses, managementQuery, screenshot, writeJson, TIMEOUT } = require('../staging-support');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');

async function answer(ctx, label, selections, expectedStatus) {
  const fixture = await assessmentRoom({ ...ctx, kind: `assessment-answer-${label}` });
  const delivered = await deliverFixedAssessment(ctx, fixture);
  await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
  const question = ctx.studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
  await question.waitFor({ timeout: TIMEOUT });
  const stop = await captureResponses(ctx.studentPage, (response) => response.url().includes('/functions/v1/assessment-api'));
  let calls;
  try {
    for (const [index, selected] of selections.entries()) {
      await question.locator(`input[value="${selected}"]`).check();
      await question.getByRole('button', { name: 'Submit answer' }).click();
      const status = selected === 'B' ? 'Correct.' : expectedStatus === 'failed' && index === selections.length - 1 ? 'Correct option(s):' : 'Incorrect.';
      await question.getByRole('status').filter({ hasText: status }).waitFor({ timeout: TIMEOUT });
    }
  } finally { calls = await stop(); }
  writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-function.json`), calls);
  assert(calls.some((call) => call.request?.operation === 'process_message' && call.status === 200), 'Assessment answer did not reach the trusted API');
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  const restored = ctx.studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
  await restored.waitFor({ timeout: TIMEOUT });
  await restored.getByRole('status').filter({ hasText: expectedStatus === 'passed' ? 'Correct.' : 'Correct option(s):' }).waitFor({ timeout: TIMEOUT });
  assert.equal(await restored.getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
  const messages = await waitForMatch(
    () => query(ctx.client, 'messages', 'id,assessment_id,assessment_result,assessment_lifecycle', 'room_id', fixture.room.id),
    (rows) => rows.some((row) => row.assessment_result === (expectedStatus === 'passed' ? 'pass' : 'fail')),
    `${label} persisted assessment result`
  );
  const privateRows = await managementQuery(ctx.config,
    `select id,lifecycle,terminal_result,attempt_count from private.transfer_assessments where id = '${delivered.assessment_id}'::uuid`);
  assert(privateRows.some((row) => row.terminal_result === expectedStatus && row.attempt_count === selections.length),
    'Private assessment result or attempt count does not match the learner answers');
  return {
    room_id: fixture.room.id, question_message_id: delivered.question_message_id,
    assessment_id: delivered.assessment_id, selections, function_calls: calls,
    public_messages: messages, private_assessment: privateRows,
    screenshot: await screenshot(ctx.studentPage, ctx.evidenceDir, `assessment-answer-${label}`)
  };
}

module.exports = async function assessmentAnswer(ctx) {
  return {
    passed: await answer(ctx, 'pass', ['B'], 'passed'),
    failed: await answer(ctx, 'failure', ['A', 'A'], 'failed')
  };
};
