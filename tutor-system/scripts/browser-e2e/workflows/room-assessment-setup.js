#!/usr/bin/env node
// File: room join, checklist, and assessment settings. Purpose: verify existing progress continues and a second student observes.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { joinAs, openRoom, query, waitForMatch, screenshot, writeJson, sendStudentMessage, captureResponses, requestId, TIMEOUT } = require('../browser-e2e-support');
const { deliverFixedAssessment } = require('./assessment-fixture');

module.exports = async function roomAssessmentSetup(ctx) {
  const { tutorPage, studentPage, appUrl, client, evidenceDir, runId } = ctx;
  const title = `Browser assessment setup ${runId}`;
  await tutorPage.goto(`${appUrl}/#/tutor`, { waitUntil: 'domcontentloaded' });
  await tutorPage.getByRole('button', { name: /Create a new Room/i }).click();
  await tutorPage.getByLabel('Room Title').fill(title);
  await tutorPage.getByLabel('Description').fill('[browser-e2e-created] New-room assessment setup');

  const createdResponse = tutorPage.waitForResponse(response =>
    response.url().includes('/rest/v1/rooms') && response.request().method() === 'POST',
  { timeout: TIMEOUT });
  await tutorPage.getByRole('button', { name: /Create Room/i }).click();
  const response = await createdResponse;
  assert.equal(response.status(), 201, 'Room creation failed');
  const body = await response.json();
  const room = Array.isArray(body) ? body[0] : body;
  assert(room?.id, 'Room creation returned no room ID');
  ctx.registerCreatedRoom(room.id);
  assert(room.title === title && room.tutor_id === ctx.tutor.id,
    'Room creation returned an unexpected room');

  // DemoTutor-owned rooms are intentionally hidden from the public room list;
  // invoke the trusted join operation, then use the returned room URL.
  const joined = await client.functions.invoke('assessment-api', {
    body: { operation: 'join_room', request_id: requestId(), room_id: room.id },
    headers: { 'x-application-user-id': ctx.student.id },
  });
  assert.equal(joined.error, null, 'Trusted learner join failed');
  assert.equal(joined.data?.ok, true, 'Trusted learner join was rejected');
  await studentPage.goto(`${appUrl}/#/room/${room.id}`, { waitUntil: 'domcontentloaded' });
  await studentPage.waitForURL(new RegExp(`#/room/${room.id}`), { timeout: TIMEOUT });
  await waitForMatch(
    () => query(client, 'sessions', 'id,student_id,status', 'room_id', room.id),
    rows => rows.some(session => session.student_id === ctx.student.id && session.status === 'active'),
    'active learner session'
  );
  await openRoom(tutorPage, appUrl, room.id);
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await tutorPage.getByRole('button', { name: 'Manual Input' }).click();
  await tutorPage.getByRole('textbox', { name: 'Detection Areas' }).fill('Check the sender domain');
  await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).fill('Open the official app');
  await tutorPage.locator('.manual-checklist-form button[type="submit"]').click();
  const checklist = (await waitForMatch(
    () => query(client, 'session_checklists', 'id,room_id,is_active', 'room_id', room.id),
    rows => rows.length === 1 && rows[0].is_active, 'one initial checklist'
  ))[0];
  const item = (await waitForMatch(
    () => query(client, 'checklist_items', 'id,area_text,status', 'checklist_id', checklist.id),
    rows => rows.length === 2, 'initial learning targets'
  )).find(row => row.area_text === 'Check the sender domain');
  assert(item, 'Initial target was not stored');
  const target = tutorPage.locator('.checklist-item').filter({ hasText: 'Check the sender domain' });
  await target.locator('.checklist-item-header').click();
  await target.locator('.status-select').selectOption('partially_covered');
  await waitForMatch(
    () => query(client, 'checklist_items', 'status', 'id', item.id),
    rows => rows[0]?.status === 'partially_covered', 'initial tutor progress'
  );

  await tutorPage.locator('button[title="AI Assistant Settings"]').click();
  await tutorPage.getByLabel('Enable AI Assistant').check();
  await tutorPage.getByLabel('Enable In-Room Assessment').check();
  await tutorPage.getByRole('button', { name: 'Save Settings' }).click();
  await waitForMatch(
    () => query(client, 'rooms', 'transfer_learning_enabled', 'id', room.id),
    rows => rows[0]?.transfer_learning_enabled === true, 'assessment setting on existing room'
  );
  await waitForMatch(
    () => query(client, 'session_checklists', 'id,student_id,progress_policy_version,is_active', 'room_id', room.id),
    rows => rows.some(row => row.id === checklist.id && row.is_active &&
      row.student_id === ctx.student.id && row.progress_policy_version === 'transfer_v1'),
    'existing checklist promoted to shared assessment policy'
  );
  await tutorPage.reload({ waitUntil: 'domcontentloaded' });
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  const after = await query(client, 'session_checklists', 'id,is_active', 'room_id', room.id);
  assert.equal(after.filter(row => row.is_active).length, 1, 'Assessment created a second progress checklist');
  assert.equal(after.find(row => row.is_active)?.id, checklist.id, 'Assessment replaced the checklist');
  assert.equal((await query(client, 'checklist_items', 'status', 'id', item.id))[0]?.status,
    'partially_covered', 'Assessment reset tutor progress');
  assert.equal(await tutorPage.getByText('Previous Learning Progress').count(), 0);

  const observerContext = await tutorPage.context().browser().newContext();
  const observerPage = await observerContext.newPage();
  try {
    await joinAs(observerPage, appUrl, `E2E Observer ${runId}`, 'student');
    const observerUser = (await query(client, 'users', 'id,display_name', 'display_name', `E2E Observer ${runId}`))[0];
    assert(observerUser?.id, 'Observer identity was not persisted');
    const observerJoin = await client.functions.invoke('assessment-api', {
      body: { operation: 'join_room', request_id: requestId(), room_id: room.id },
      headers: { 'x-application-user-id': observerUser.id },
    });
    assert.equal(observerJoin.error, null, 'Trusted observer join failed');
    assert.equal(observerJoin.data?.ok, true, 'Trusted observer join was rejected');
    await observerPage.goto(`${appUrl}/#/student`, { waitUntil: 'domcontentloaded' });
    await observerPage.evaluate((roomId) => sessionStorage.setItem(`room-observer:${roomId}`, 'true'), room.id);
    await observerPage.goto(`${appUrl}/#/room/${room.id}`, { waitUntil: 'domcontentloaded' });
    await observerPage.waitForURL(new RegExp(`#/room/${room.id}`), { timeout: TIMEOUT });
    await observerPage.getByText(/observer mode/i).waitFor({ state: 'visible', timeout: TIMEOUT });
    assert.equal(await observerPage.locator('textarea.comment-input-field').count(), 0);
  } finally {
    await observerContext.close();
  }

  const focusContent = 'I will open the official app myself instead of using the warning link.';
  await sendStudentMessage(studentPage, focusContent);
  const focus = (await query(client, 'messages', 'id,content,user_id,created_at', 'room_id', room.id))
    .filter(row => row.user_id === ctx.student.id && row.content === focusContent)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)).at(-1);
  assert(focus?.id, 'Learner evidence message was not persisted');
  const { error: signalError } = await client.rpc('apply_learning_event_v1', {
    p_event: {
      event_id: requestId(),
      dedupe_key: `room-assessment-setup:${focus.id}`,
      kind: 'initial_signal',
      room_id: room.id,
      student_id: ctx.student.id,
      item_id: item.id,
      source_message_id: focus.id,
      source_evidence_message_ids: [focus.id],
      evidence_text: 'Learner chose independent verification.',
      classified_by: 'trusted_backend',
    },
  });
  if (signalError) throw new Error(`Assessment fixture signal: ${signalError.message}`);
  const { error: understandingError } = await client.rpc('edit_room_checklist_v1', {
    p_room_id: room.id,
    p_actor_id: ctx.tutor.id,
    p_request_id: requestId(),
    p_action: 'set_understanding',
    p_item_id: item.id,
    p_payload: { understanding_level: 'basic' },
  });
  if (understandingError) throw new Error(`Assessment fixture understanding: ${understandingError.message}`);

  // Exercise the real tutor AI action in the newly created room. The previous
  // fixture delivery path bypassed this UI/API boundary entirely.
  await openRoom(tutorPage, appUrl, room.id);
  const prepareStop = await captureResponses(tutorPage,
    response => response.url().includes('/functions/v1/assessment-api'));
  let prepareCalls;
  try {
    const preparation = tutorPage.waitForResponse(response =>
      response.url().includes('/functions/v1/assessment-api') &&
      response.request().postDataJSON()?.operation === 'prepare_turn', { timeout: TIMEOUT });
    await tutorPage.locator('button.ai-generate-btn').click();
    const preparationResponse = await preparation;
    assert.equal(preparationResponse.status(), 200, 'Tutor AI assessment preparation failed');
    await tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).waitFor({ timeout: TIMEOUT });
    await tutorPage.getByRole('button', { name: 'Discard candidate' }).click();
  } finally {
    prepareCalls = await prepareStop();
  }
  const prepareCall = prepareCalls.find(call => call.request?.operation === 'prepare_turn');
  assert.equal(prepareCall?.status, 200, 'Tutor AI response did not complete successfully');
  assert.equal(prepareCall?.response?.ok, true, 'Tutor AI response returned an error envelope');

  const delivered = await deliverFixedAssessment(ctx, {
    room, checklist, items: [item], focus,
  });
  await studentPage.reload({ waitUntil: 'domcontentloaded' });
  const question = studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
  await question.waitFor({ timeout: TIMEOUT });
  await question.locator('input[value="B"]').check();
  await question.getByRole('button', { name: 'Submit answer' }).click();
  await question.getByRole('status').filter({ hasText: 'Correct.' }).waitFor({ timeout: TIMEOUT });
  await waitForMatch(
    () => query(client, 'messages', 'assessment_id,assessment_result', 'room_id', room.id),
    rows => rows.some(row => row.assessment_id === delivered.assessment_id && row.assessment_result === 'pass'),
    'persisted assessment result'
  );
  const evidence = {
    room_id: room.id, tutor_id: ctx.tutor.id, learner_id: ctx.student.id,
    checklist_id: checklist.id, item_id: item.id, persisted_status: 'partially_covered',
    learner_message_count: (await query(client, 'messages', 'id', 'room_id', room.id)).length,
    assessment_id: delivered.assessment_id,
    assessment_result_persisted: true,
    observer_read_only: true,
    screenshot: await screenshot(tutorPage, evidenceDir, 'room-assessment-setup')
  };
  writeJson(path.join(evidenceDir, 'room-assessment-setup.json'), evidence);
  assert(evidence.learner_message_count > 0, 'Learner evidence should be persisted before assessment delivery');
  return evidence;
};
