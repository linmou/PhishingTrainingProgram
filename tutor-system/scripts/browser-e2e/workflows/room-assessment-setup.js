#!/usr/bin/env node
// File: room join, checklist, and assessment settings. Purpose: verify existing progress continues and a second student observes.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { joinAs, openRoom, query, waitForMatch, screenshot, writeJson, sendStudentMessage, requestId, TIMEOUT } = require('../browser-e2e-support');
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

  await studentPage.goto(`${appUrl}/#/student`, { waitUntil: 'domcontentloaded' });
  await studentPage.getByPlaceholder('Search by title or description...').fill(title);
  await studentPage.getByRole('button', { name: 'Join Room' }).click();
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
    await observerPage.getByPlaceholder('Search by title or description...').fill(title);
    await observerPage.getByRole('button', { name: 'Observe Room' }).click();
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
