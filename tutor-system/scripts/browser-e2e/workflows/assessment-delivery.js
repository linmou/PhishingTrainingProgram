#!/usr/bin/env node
// Purpose: verify learner status events and a real transfer assessment in one room.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, captureResponses, managementQuery, query, waitForMatch, screenshot, writeJson, TIMEOUT } = require('../browser-e2e-support');
const { startStatusJourney } = require('./transfer-status-events');

module.exports = async function assessmentDelivery(ctx) {
  const journey = await startStatusJourney(ctx);
  const focus = journey.observations.at(-1).message;
  writeJson(path.join(ctx.evidenceDir, 'assessment-delivery-fixture.json'), {
    room_id: journey.room.id, checklist_id: journey.checklist_id,
    template_target_count: journey.template_target_count,
    focus_message_id: focus.id, status_observations: journey.observations
  });
  const beforeAssessment = await query(ctx.client, 'checklist_items', 'id,area_text,status', 'checklist_id', journey.checklist_id);
  const checklistClose = ctx.tutorPage.locator('.checklist-close');
  if (await checklistClose.isVisible()) await checklistClose.click();
  const stop = await captureResponses(ctx.tutorPage, (response) => response.url().includes('/functions/v1/assessment-api'));
  let calls;
  let prepareError;
  try {
    const preparation = ctx.tutorPage.waitForResponse(response => response.url().includes('/functions/v1/assessment-api') &&
      response.request().postDataJSON()?.operation === 'prepare_turn', { timeout: TIMEOUT });
    await ctx.tutorPage.locator('button.ai-generate-btn').click();
    const response = await preparation;
    if (response.status() !== 200) throw new Error(`Transfer preparation returned HTTP ${response.status()}`);
    await ctx.tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).waitFor({ timeout: TIMEOUT });
  } catch (error) {
    prepareError = error;
  } finally {
    calls = await stop();
    writeJson(path.join(ctx.evidenceDir, 'assessment-delivery-function.json'), calls);
  }
  const prepared = calls.find((call) => call.request?.operation === 'prepare_turn');
  assert.match(prepared?.request?.request_id || '', /^[0-9a-f-]{36}$/i, 'Transfer preparation did not complete');
  const providerAttempts = await managementQuery(ctx.config,
    `select request_id,attempt_ordinal,provider_model,request_payload,raw_response,validation_outcome,error_code from private.transfer_provider_attempts where request_id = '${prepared.request.request_id}'::uuid order by attempt_ordinal`);
  writeJson(path.join(ctx.evidenceDir, 'assessment-delivery-provider.json'), providerAttempts);
  if (prepareError) throw new Error(`Transfer preparation failed: HTTP ${prepared.status}, ${JSON.stringify(prepared.response?.error)}, provider outcomes ${providerAttempts.map(attempt => attempt.validation_outcome).join(', ')}`, { cause: prepareError });
  assert.equal(prepared.status, 200, 'Transfer preparation did not complete');
  assert(providerAttempts.some((attempt) => attempt.validation_outcome === 'valid'), 'No valid transfer provider attempt');
  const correctOptions = await ctx.tutorPage.locator('input[name="assessment-correct-option"]:checked')
    .evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label').replace('Correct answer ', '')));
  assert(correctOptions.length > 0, 'Review editor has no answer key');
  if (process.env.E2E_RECORD_VIDEO === '1') await ctx.tutorPage.waitForTimeout(2200);
  await ctx.tutorPage.getByRole('button', { name: 'Send assessment' }).click();
  const publicMessages = await waitForMatch(
    () => query(ctx.client, 'messages', 'id,assessment_id,assessment_lifecycle', 'room_id', journey.room.id),
    (rows) => rows.some((row) => row.assessment_id && row.assessment_lifecycle === 'delivered'),
    'delivered assessment in public messages'
  );
  const questionMessage = publicMessages.find(row => row.assessment_id && row.assessment_lifecycle === 'delivered');
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  const question = ctx.studentPage.locator(`[data-testid="public-assessment-${questionMessage.assessment_id}"]`);
  await question.waitFor({ timeout: TIMEOUT });
  const deliveredScreenshot = await screenshot(ctx.studentPage, ctx.evidenceDir, 'assessment-delivery-learner');
  if (process.env.E2E_RECORD_VIDEO === '1') await ctx.studentPage.waitForTimeout(2200);
  const answerStop = await captureResponses(ctx.studentPage, response => response.url().includes('/functions/v1/assessment-api'));
  let answerCalls;
  try {
    for (const option of correctOptions) await question.locator(`input[value="${option}"]`).check();
    await question.getByRole('button', { name: 'Submit answer' }).click();
    await question.getByRole('status').filter({ hasText: 'Correct.' }).waitFor({ timeout: TIMEOUT });
  } finally {
    answerCalls = await answerStop();
  }
  assert(answerCalls.some(call => call.request?.operation === 'process_message' && call.status === 200),
    'Assessment answer did not reach the trusted API');
  const completed = await waitForMatch(
    () => query(ctx.client, 'messages', 'id,assessment_id,assessment_result', 'room_id', journey.room.id),
    rows => rows.some(row => row.assessment_id === questionMessage.assessment_id && row.assessment_result === 'pass'),
    'persisted assessment pass'
  );
  const privateAssessment = await managementQuery(ctx.config,
    `select item_id,lifecycle,terminal_result,attempt_count from private.transfer_assessments where id='${questionMessage.assessment_id}'::uuid`);
  assert.equal(privateAssessment[0]?.terminal_result, 'passed');
  assert.equal(privateAssessment[0]?.attempt_count, 1);
  const assessedItem = beforeAssessment.find(item => item.id === privateAssessment[0]?.item_id);
  assert.equal(privateAssessment[0]?.item_id, prepared.response?.data?.item_id,
    'Delivered assessment differs from the prepared target');
  assert.equal(assessedItem?.status, 'partially_covered', 'Assessment did not target a partially covered template item');
  const assessmentEvents = await managementQuery(ctx.config,
    `select event_kind,event_payload,processing_state from private.learning_event_inbox where room_id='${journey.room.id}'::uuid and event_kind='assessment_pass' and event_payload->>'assessment_id'='${questionMessage.assessment_id}'`);
  assert(assessmentEvents.some(row => row.processing_state === 'applied'), 'Assessment pass event was not applied');
  const progress = (await query(ctx.client, 'checklist_items', 'status,understanding_level', 'id', assessedItem.id))[0];
  assert.equal(progress?.status, 'covered');
  assert.equal(progress?.understanding_level, 'good');
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  const restored = ctx.studentPage.locator(`[data-testid="public-assessment-${questionMessage.assessment_id}"]`);
  await restored.getByRole('status').filter({ hasText: 'Correct.' }).waitFor({ timeout: TIMEOUT });
  assert.equal(await restored.getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
  await openRoom(ctx.tutorPage, ctx.appUrl, journey.room.id);
  await ctx.tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await ctx.tutorPage.locator('.checklist-item').filter({ hasText: assessedItem.area_text })
    .locator('.status-icon.covered').waitFor();
  if (process.env.E2E_RECORD_VIDEO === '1') await ctx.tutorPage.waitForTimeout(2200);
  return {
    room_id: journey.room.id, checklist_id: journey.checklist_id,
    template_target_count: journey.template_target_count, assessed_item: assessedItem,
    focus_message_id: focus.id,
    status_observations: journey.observations, function_calls: calls, provider_attempts: providerAttempts,
    public_messages: completed, assessment_id: questionMessage.assessment_id, correct_options: correctOptions,
    answer_calls: answerCalls, private_assessment: privateAssessment, assessment_events: assessmentEvents, progress,
    screenshots: [await screenshot(ctx.tutorPage, ctx.evidenceDir, 'assessment-delivery-tutor'),
      deliveredScreenshot, await screenshot(ctx.studentPage, ctx.evidenceDir, 'assessment-answer-learner')]
  };
};
