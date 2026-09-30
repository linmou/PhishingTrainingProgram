#!/usr/bin/env node
// Purpose: verify live learner-message coverage updates and subsequent tutor context.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, sendStudentMessage, insert, query, waitForMatch, captureResponses, screenshot, writeJson, TIMEOUT } = require('../staging-support');

module.exports = async function checklistCoverage(ctx) {
  const { client, tutorPage, studentPage, appUrl, evidenceDir } = ctx;
  const room = await ctx.existingRoom('checklist-coverage');
  const checklist = await insert(client, 'session_checklists', {
    room_id: room.id, template_name: 'Browser E2E coverage v2', progress_policy_version: 'legacy_v1',
    is_active: true, total_items: 2
  });
  const item = await insert(client, 'checklist_items', {
    checklist_id: checklist.id, area_text: 'Open the official app instead of an urgent message link',
    item_type: 'verification_step', priority: 'critical', status: 'pending', understanding_level: 'none'
  });
  await insert(client, 'checklist_items', {
    checklist_id: checklist.id, area_text: 'Recognize pressure to respond immediately',
    item_type: 'detection_area', priority: 'important', status: 'pending', understanding_level: 'none'
  });
  await openRoom(studentPage, appUrl, room.id);
  const stopAnalysis = await captureResponses(studentPage, (response) => response.url().includes('/chat/completions'));
  let analysisCalls;
  try {
    await sendStudentMessage(studentPage,
      'I would not use the urgent message link. I would open the official app myself and check the warning there.');
  } finally { analysisCalls = await stopAnalysis(); }
  writeJson(path.join(evidenceDir, 'checklist-coverage-provider.json'), analysisCalls);
  assert(analysisCalls.some((call) => call.status === 200 && JSON.stringify(call.request).includes('Analyze this student')), 'No successful live coverage analysis call');
  const updated = await waitForMatch(
    () => query(client, 'checklist_items', 'id,status,understanding_level', 'id', item.id),
    (rows) => rows[0]?.status !== 'pending', 'analyzed checklist progress'
  );
  await openRoom(tutorPage, appUrl, room.id);
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await tutorPage.locator('.checklist-item').filter({ hasText: 'Open the official app' }).waitFor({ timeout: TIMEOUT });
  await tutorPage.locator('.checklist-close').click();
  const stopTutor = await captureResponses(tutorPage, (response) => response.url().includes('/chat/completions'));
  let tutorCalls;
  try {
    await tutorPage.locator('button.ai-generate-btn').click();
    await tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().waitFor({ timeout: TIMEOUT });
  } finally { tutorCalls = await stopTutor(); }
  writeJson(path.join(evidenceDir, 'checklist-coverage-tutor-provider.json'), tutorCalls);
  assert(tutorCalls.some((call) => call.status === 200 && JSON.stringify(call.request).includes('CURRENT LEARNING PROGRESS')),
    'Next tutor request did not include current checklist progress');
  return {
    room_id: room.id, checklist_id: checklist.id, item: updated[0],
    analysis_calls: analysisCalls, tutor_calls: tutorCalls,
    screenshots: [await screenshot(studentPage, evidenceDir, 'checklist-coverage-learner'),
      await screenshot(tutorPage, evidenceDir, 'checklist-coverage-tutor')]
  };
};
