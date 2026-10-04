#!/usr/bin/env node
// Purpose: verify live transfer analysis events against persisted learner progress.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {
  openRoom, sendStudentMessage, insert, query, managementQuery,
  captureResponses, screenshot, writeJson
} = require('../browser-e2e-support');

function templateChecklistItems(promptConfig) {
  const detectionAreas = promptConfig?.detection_areas;
  const verificationSteps = promptConfig?.verification_steps;
  assert(Array.isArray(detectionAreas) && detectionAreas.length > 0 &&
    detectionAreas.every(text => typeof text === 'string' && text.trim()), 'Room template has no valid detection areas');
  assert(Array.isArray(verificationSteps) && verificationSteps.length > 0 &&
    verificationSteps.every(text => typeof text === 'string' && text.trim()), 'Room template has no valid verification steps');
  return [
    ...detectionAreas.map(area_text => ({ area_text, item_type: 'detection_area', priority: 'important' })),
    ...verificationSteps.map(area_text => ({ area_text, item_type: 'verification_step', priority: 'critical' }))
  ];
}

async function startStatusJourney(ctx) {
  const room = await ctx.existingRoom('assessment-delivery');
  await insert(ctx.client, 'sessions', {
    room_id: room.id, tutor_id: room.tutor_id, student_id: ctx.student.id, status: 'active'
  });
  const configs = await query(ctx.client, 'ai_assistant_configs', 'prompt_config,is_active', 'room_id', room.id);
  const config = configs.find(row => row.is_active);
  assert(config, 'Room template has no active AI configuration');
  const templateItems = templateChecklistItems(config.prompt_config);
  const directTarget = templateItems.find(item => item.area_text.startsWith('Official Account Check:'));
  const explanationTarget = templateItems.find(item => item.area_text.startsWith('URL Domain Check:'));
  assert(directTarget && explanationTarget, 'Account warning template is missing the status assessment targets');
  const { data: initialized, error } = await ctx.client.rpc('initialize_transfer_checklist_v1', {
    p_room_id: room.id, p_student_id: ctx.student.id, p_actor_id: ctx.tutor.id,
    p_items: templateItems
  });
  if (error) throw new Error(`Transfer checklist initialization: ${error.message}`);
  const items = await query(ctx.client, 'checklist_items', 'id,area_text,item_type', 'checklist_id', initialized.checklist_id);
  assert.equal(items.length, templateItems.length, 'Transfer checklist dropped template targets');
  assert.deepEqual(items.map(({ area_text, item_type }) => `${item_type}:${area_text}`).sort(),
    templateItems.map(({ area_text, item_type }) => `${item_type}:${area_text}`).sort(),
    'Transfer checklist differs from the room template');
  const direct = items.find(item => item.area_text === directTarget.area_text);
  const explanation = items.find(item => item.area_text === explanationTarget.area_text);
  assert(direct?.id && explanation?.id, 'Transfer status targets were not stored');
  const unrelatedPrefixes = ['Spelling Error:', 'Login Activity:', 'Security Review:', 'Official Support:'];
  const unrelatedIds = new Set(items.filter(item => unrelatedPrefixes.some(prefix => item.area_text.startsWith(prefix))).map(item => item.id));
  assert.equal(unrelatedIds.size, unrelatedPrefixes.length, 'Missing unrelated template targets');
  const observations = [];

  async function observe(content, item, expectedKind, expectedStatus, expectedLevel) {
    const before = new Set((await query(ctx.client, 'messages', 'id', 'room_id', room.id)).map(row => row.id));
    const stop = await captureResponses(ctx.studentPage, response => response.url().includes('/functions/v1/assessment-api'));
    let calls;
    try {
      await Promise.all([
        sendStudentMessage(ctx.studentPage, content),
        ctx.studentPage.waitForResponse(response =>
          response.url().includes('/functions/v1/assessment-api') &&
          response.request().postDataJSON()?.operation === 'analyze_message', { timeout: 90000 })
      ]);
    } finally {
      calls = await stop();
    }
    const message = (await query(ctx.client, 'messages', 'id,content,user_id', 'room_id', room.id))
      .find(row => !before.has(row.id) && row.user_id === ctx.student.id && row.content === content);
    assert(message?.id, 'Student message was not persisted');
    const analysis = calls.find(call => call.request?.operation === 'analyze_message');
    const rows = await managementQuery(ctx.config,
      `select event_kind,event_payload,processing_state from private.learning_event_inbox where room_id='${room.id}'::uuid and source_message_id='${message.id}'::uuid order by created_at`);
    const observation = { room_id: room.id, message, item_id: item.id, expected_kind: expectedKind, function_calls: calls, inbox: rows };
    observations.push(observation);
    writeJson(path.join(ctx.evidenceDir, 'transfer-status-events.json'), observations);
    assert.equal(analysis?.status, 200, `Analysis failed for ${message.id}: ${JSON.stringify(analysis?.response)}`);
    const analysisEvents = rows.find(row => row.event_kind === 'analysis_complete')?.event_payload?.analysis?.events;
    assert(Array.isArray(analysisEvents), 'Model analysis was not recorded');
    assert.deepEqual(analysisEvents.filter(entry => entry.item_id === item.id).map(entry => entry.kind),
      expectedKind ? [expectedKind] : [], `Unexpected model event for ${item.id}`);
    const event = rows.find(row => row.event_kind === expectedKind);
    if (expectedKind) {
      assert(event, `Expected ${expectedKind} for ${message.id}; observed ${rows.map(row => row.event_kind)}`);
      assert.equal(event.processing_state, 'applied');
      assert(event.event_payload?.source_evidence_message_ids?.includes(message.id), 'Event did not cite the current learner message');
    } else {
      assert.deepEqual(rows.filter(row => row.processing_state === 'applied' && row.event_kind !== 'analysis_complete'), [],
        'A no-evidence learner message changed progress');
    }
    const progress = (await query(ctx.client, 'checklist_items', 'id,status,understanding_level', 'id', item.id))[0];
    assert.equal(progress?.status, expectedStatus, `Unexpected progress for ${item.id}`);
    assert.equal(progress?.understanding_level, expectedLevel);
    observation.progress = progress;
    writeJson(path.join(ctx.evidenceDir, 'transfer-status-events.json'), observations);
    await openRoom(ctx.tutorPage, ctx.appUrl, room.id);
    await ctx.tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    const visibleItem = ctx.tutorPage.locator('.checklist-item').filter({ hasText: item.area_text });
    await visibleItem.waitFor();
    const statusClass = { pending: 'pending', partially_covered: 'partial', covered: 'covered', needs_review: 'review' }[expectedStatus];
    await visibleItem.locator(`.status-icon.${statusClass}`).waitFor();
    if (expectedStatus !== 'pending') {
      await visibleItem.locator(`.understanding-${expectedLevel}`).waitFor();
    }
    if (process.env.E2E_RECORD_VIDEO === '1') {
      observation.screenshot = await screenshot(ctx.tutorPage, ctx.evidenceDir, `status-${observations.length}-${expectedKind || 'no-event'}`);
      await ctx.tutorPage.waitForTimeout(3500);
    }
  }

  await openRoom(ctx.studentPage, ctx.appUrl, room.id);
  await openRoom(ctx.tutorPage, ctx.appUrl, room.id);
  await ctx.tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await ctx.tutorPage.locator('.checklist-item').filter({ hasText: directTarget.area_text }).waitFor();
  await observe("Probably not. I won't use that account reset link; I'll open the real app myself to see if anything's wrong.",
    direct, 'demonstrated_understanding', 'covered', 'good');
  const unrelatedProgress = await query(ctx.client, 'checklist_items', 'id,status', 'checklist_id', initialized.checklist_id);
  assert(unrelatedProgress.filter(item => unrelatedIds.has(item.id)).every(item => item.status === 'pending'),
    'Safe action advanced an unmentioned template target');
  const untouched = (await query(ctx.client, 'checklist_items', 'status,understanding_level', 'id', explanation.id))[0];
  assert.equal(untouched?.status, 'pending', 'Safe action advanced the explanation target');
  assert.equal(untouched?.understanding_level, 'none');
  await observe("I notice the link says testdrive.info, but I'm not sure whether that is the real social media website.",
    explanation, 'initial_signal', 'partially_covered', 'basic');
  return { room, checklist_id: initialized.checklist_id, template_target_count: templateItems.length,
    direct, explanation, observations, observe };
}

async function transferStatusEvents(ctx) {
  const { room, checklist_id, template_target_count, direct, explanation, observations, observe } = await startStatusJourney(ctx);
  await observe('testdrive.info is not the social media platform address. I would go to the real site myself instead of using that link.',
    explanation, 'demonstrated_understanding', 'covered', 'good');
  await observe('Actually, I do not need to check my real account separately. If the sender looks familiar, I can sign in through the alert link.',
    direct, 'contradiction', 'needs_review', 'basic');
  await observe('We were talking about account reset alerts. For a delivery alert instead, I would ignore its text link because it could lead to a fake sign-in page, then open the shipping company app myself to see if a real delivery notice is there.',
    direct, 'spontaneous_transfer', 'covered', 'good');
  await observe('What is the weather today?', direct, null, 'covered', 'good');
  await observe('On second thought, an official-looking logo is enough; I would use the account reset link without checking my real account.',
    direct, 'contradiction', 'needs_review', 'basic');
  return {
    room_id: room.id, checklist_id, template_target_count, observations,
    screenshots: [await screenshot(ctx.studentPage, ctx.evidenceDir, 'transfer-status-student'),
      await screenshot(ctx.tutorPage, ctx.evidenceDir, 'transfer-status-tutor')]
  };
}

module.exports = transferStatusEvents;
module.exports.startStatusJourney = startStatusJourney;
module.exports.templateChecklistItems = templateChecklistItems;
