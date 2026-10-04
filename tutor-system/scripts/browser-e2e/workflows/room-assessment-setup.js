#!/usr/bin/env node
// File: src/pages/TutorView.tsx, src/components/AIAssistantSettings.tsx, and src/components/ChecklistPanel.tsx. Purpose: verify a newly created assessment room lets its learner's tutor generate targets.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, query, waitForMatch, screenshot, writeJson, TIMEOUT } = require('../browser-e2e-support');

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

  await openRoom(tutorPage, appUrl, room.id);
  await tutorPage.locator('button[title="AI Assistant Settings"]').click();
  await tutorPage.getByLabel('Enable AI Assistant').check();
  await tutorPage.getByLabel('Enable In-Room Assessment').check();
  await tutorPage.getByRole('button', { name: 'Save Settings' }).click();
  await waitForMatch(
    () => query(client, 'rooms', 'transfer_learning_enabled', 'id', room.id),
    rows => rows[0]?.transfer_learning_enabled === true,
    'assessment setting on new room'
  );

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
  const generate = tutorPage.getByRole('button', { name: 'Generate Learning Targets' });
  await generate.waitFor({ state: 'visible', timeout: TIMEOUT });
  const enabled = await generate.isEnabled();
  const evidence = {
    room_id: room.id, tutor_id: ctx.tutor.id, learner_id: ctx.student.id,
    learner_message_count: (await query(client, 'messages', 'id', 'room_id', room.id)).length,
    generate_enabled: enabled,
    screenshot: await screenshot(tutorPage, evidenceDir, 'room-assessment-setup')
  };
  writeJson(path.join(evidenceDir, 'room-assessment-setup.json'), evidence);
  assert.equal(evidence.learner_message_count, 0, 'Learner should not need to post before target setup');
  assert.equal(enabled, true, 'Tutor cannot generate learning targets after a learner joins a new assessment room');
  return evidence;
};
