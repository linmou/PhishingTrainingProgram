#!/usr/bin/env node
// Purpose: verify real assessment preparation, tutor review, and delivery in staging.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, captureResponses, managementQuery, query, waitForMatch, screenshot, writeJson, TIMEOUT } = require('../browser-e2e-support');
const { assessmentRoom } = require('./assessment-fixture');

module.exports = async function assessmentDelivery(ctx) {
  const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-delivery' });
  writeJson(path.join(ctx.evidenceDir, 'assessment-delivery-fixture.json'), fixture);
  await openRoom(ctx.tutorPage, ctx.appUrl, fixture.room.id);
  const checklistClose = ctx.tutorPage.locator('.checklist-close');
  if (await checklistClose.isVisible()) await checklistClose.click();
  const stop = await captureResponses(ctx.tutorPage, (response) => response.url().includes('/functions/v1/assessment-api'));
  let calls;
  try {
    await ctx.tutorPage.locator('button.ai-generate-btn').click();
    await ctx.tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).waitFor({ timeout: TIMEOUT });
  } finally {
    calls = await stop();
    writeJson(path.join(ctx.evidenceDir, 'assessment-delivery-function.json'), calls);
  }
  const prepared = calls.find((call) => call.request?.operation === 'prepare_turn' && call.status === 200);
  assert.match(prepared?.request?.request_id || '', /^[0-9a-f-]{36}$/i, 'Transfer preparation did not complete');
  const providerAttempts = await managementQuery(ctx.config,
    `select request_id,attempt_ordinal,provider_model,request_payload,raw_response,validation_outcome,error_code from private.transfer_provider_attempts where request_id = '${prepared.request.request_id}'::uuid order by attempt_ordinal`);
  writeJson(path.join(ctx.evidenceDir, 'assessment-delivery-provider.json'), providerAttempts);
  assert(providerAttempts.some((attempt) => attempt.validation_outcome === 'valid'), 'No valid transfer provider attempt');
  assert((await ctx.tutorPage.locator('input[name="assessment-correct-option"]:checked').count()) > 0, 'Review editor has no answer key');
  await ctx.tutorPage.getByRole('button', { name: 'Send assessment' }).click();
  const publicMessages = await waitForMatch(
    () => query(ctx.client, 'messages', 'id,assessment_id,assessment_lifecycle', 'room_id', fixture.room.id),
    (rows) => rows.some((row) => row.assessment_id && row.assessment_lifecycle === 'delivered'),
    'delivered assessment in public messages'
  );
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  await ctx.studentPage.locator('[data-testid^="public-assessment-"]').last().waitFor({ timeout: TIMEOUT });
  return {
    room_id: fixture.room.id, checklist_id: fixture.checklist.id, focus_message_id: fixture.focus.id,
    function_calls: calls, provider_attempts: providerAttempts, public_messages: publicMessages,
    screenshots: [await screenshot(ctx.tutorPage, ctx.evidenceDir, 'assessment-delivery-tutor'),
      await screenshot(ctx.studentPage, ctx.evidenceDir, 'assessment-delivery-learner')]
  };
};
