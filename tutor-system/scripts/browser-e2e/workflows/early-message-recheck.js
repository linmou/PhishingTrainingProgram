#!/usr/bin/env node
// File: checklistService.ts and ChecklistPanel.tsx. Purpose: verify real early-message replay, progress persistence, and duplicate prevention through the browser.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, query, waitForMatch, sendStudentMessage, captureResponses,
  managementQuery, screenshot, writeJson, TIMEOUT } = require('../browser-e2e-support');

module.exports = async function earlyMessageRecheck(ctx) {
  const { tutorPage, studentPage, appUrl, client, evidenceDir } = ctx;
  const room = await ctx.existingRoom('assessment-delivery');
  const evidence = { room_id: room.id, learner_id: ctx.student.id, stages: {}, screenshots: [] };
  const file = path.join(evidenceDir, 'early-message-recheck.json');
  const save = () => writeJson(file, evidence);
  const inbox = () => managementQuery(ctx.config,
    `select event_id,source_message_id,event_kind,event_payload,processing_state,created_at
     from private.learning_event_inbox where room_id='${room.id}'::uuid order by created_at,event_id`);
  const messages = () => query(client, 'messages', 'id,content,user_id,user_role,assessment_id,created_at', 'room_id', room.id);
  const stopTutor = await captureResponses(tutorPage, response => response.url().includes('/functions/v1/assessment-api'));
  const stopStudent = await captureResponses(studentPage, response => response.url().includes('/functions/v1/assessment-api'));
  try {
    await openRoom(studentPage, appUrl, room.id);
    await waitForMatch(() => query(client, 'sessions', 'student_id,status', 'room_id', room.id),
      rows => rows.some(row => row.student_id === ctx.student.id && row.status === 'active'), 'active learner');
    await openRoom(tutorPage, appUrl, room.id);
    const earlyContent = [
      'An alert link could lead to a fake sign-in page. I would open the official account app myself and check the alert there, without using its link.',
      'The urgent deadline is pressure to make me act before I verify who sent it, so I should pause instead of reacting to it.'
    ];
    for (const content of earlyContent) await sendStudentMessage(studentPage, content);
    const earlyMessages = (await messages()).filter(row => row.user_id === ctx.student.id && row.user_role === 'student')
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    assert.deepEqual(earlyMessages.map(row => row.content), earlyContent, 'Early messages were not persisted in order');
    evidence.stages.before_goals = { messages: earlyMessages,
      checklists: await query(client, 'session_checklists', '*', 'room_id', room.id), inbox: await inbox() };
    save();
    assert.equal(evidence.stages.before_goals.checklists.length, 0, 'Goals existed before the early learner messages');
    assert.equal(evidence.stages.before_goals.inbox.length, 0, 'Early messages were already analyzed');
    evidence.screenshots.push(await screenshot(studentPage, evidenceDir, 'early-message-before-goals'));

    const targets = ['Recognize an urgent deadline as pressure to act without checking',
      'Open the official account app directly instead of following an alert link'];
    const learnerLoaded = tutorPage.waitForResponse(response =>
      response.url().includes('/rest/v1/sessions?') && response.request().method() === 'GET', { timeout: TIMEOUT });
    await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    await learnerLoaded;
    await tutorPage.locator('.checklist-loading').waitFor({ state: 'hidden', timeout: TIMEOUT });
    await tutorPage.getByRole('button', { name: 'Enter Manually', exact: true }).click();
    await tutorPage.getByRole('textbox', { name: 'Detection Areas' }).fill(targets[0]);
    await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).fill(targets[1]);
    assert.equal(await tutorPage.getByRole('textbox', { name: 'Detection Areas' }).inputValue(), targets[0]);
    assert.equal(await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).inputValue(), targets[1]);
    evidence.screenshots.push(await screenshot(tutorPage, evidenceDir, 'early-message-goals-entered'));
    await tutorPage.locator('.manual-checklist-form button[type="submit"]').click();
    for (const target of targets) {
      const item = tutorPage.locator('.checklist-item').filter({ hasText: target });
      await item.locator('.status-icon.covered').waitFor({ timeout: TIMEOUT });
      await item.locator('.understanding-good').waitFor({ timeout: TIMEOUT });
    }
    const checklist = (await query(client, 'session_checklists', '*', 'room_id', room.id))[0];
    assert(checklist?.id, 'Goal saving did not create a checklist');
    evidence.checklist_id = checklist.id;
    const items = () => query(client, 'checklist_items', '*', 'checklist_id', checklist.id);
    evidence.stages.after_goals = { checklist, items: await items(), inbox: await inbox() };
    evidence.screenshots.push(await screenshot(tutorPage, evidenceDir, 'early-message-goals-rechecked'));
    save();
    for (const message of earlyMessages) {
      const rows = evidence.stages.after_goals.inbox.filter(row => row.source_message_id === message.id);
      assert.equal(rows.filter(row => row.event_kind === 'analysis_complete').length, 1,
        `Expected one completed analysis for early message ${message.id}`);
      assert.equal(rows.find(row => row.event_kind === 'analysis_complete').processing_state, 'applied',
        `Analysis did not complete for early message ${message.id}`);
    }
    assert(evidence.stages.after_goals.inbox.some(row => row.event_kind !== 'analysis_complete' && row.processing_state === 'applied'),
      'Rechecking earlier learner evidence did not update progress');
    assert.equal(evidence.stages.after_goals.items.length, 2);
    assert(evidence.stages.after_goals.items.every(row => row.status === 'covered' && row.understanding_level === 'good'));

    // A later unrelated message replays the cold learner history against the same
    // backend ledger. It must leave the early effects unchanged and be marked once.
    const unrelated = 'What is the weather today?';
    const finished = studentPage.waitForResponse(response => response.url().includes('/functions/v1/assessment-api') &&
      response.request().postDataJSON()?.operation === 'analyze_message' &&
      response.request().postDataJSON()?.message_id !== earlyMessages[0].id &&
      response.request().postDataJSON()?.message_id !== earlyMessages[1].id, { timeout: TIMEOUT });
    await sendStudentMessage(studentPage, unrelated);
    await finished;
    evidence.stages.after_later_message = { messages: await messages(), items: await items(), inbox: await inbox() };
    save();
    const later = evidence.stages.after_later_message.messages.find(row => row.content === unrelated && row.user_id === ctx.student.id);
    assert(later, 'Later learner message was not saved');
    assert.deepEqual(evidence.stages.after_later_message.inbox.filter(row => row.source_message_id !== later.id),
      evidence.stages.after_goals.inbox, 'History replay duplicated or changed early progress events');
    const laterEvents = evidence.stages.after_later_message.inbox.filter(row => row.source_message_id === later.id);
    assert.equal(laterEvents.filter(row => row.event_kind === 'analysis_complete').length, 1);
    assert.equal(laterEvents.filter(row => row.event_kind !== 'analysis_complete' && row.processing_state === 'applied').length, 0,
      'Unrelated learner message changed progress');

    await openRoom(tutorPage, appUrl, room.id);
    await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    for (const target of targets) {
      await tutorPage.locator('.checklist-item').filter({ hasText: target }).locator('.status-icon.covered').waitFor({ timeout: TIMEOUT });
    }
    evidence.stages.after_reload = { items: await items(), inbox: await inbox() };
    assert.deepEqual(evidence.stages.after_reload.inbox, evidence.stages.after_later_message.inbox,
      'Reload changed the persisted analysis ledger');
    evidence.screenshots.push(await screenshot(tutorPage, evidenceDir, 'early-message-progress-after-reload'));
  } finally {
    evidence.final_database = { messages: await messages(),
      checklists: await query(client, 'session_checklists', '*', 'room_id', room.id), inbox: await inbox() };
    evidence.function_calls = { tutor: await stopTutor(), learner: await stopStudent() };
    save();
  }
  const tutorAnalysis = evidence.function_calls.tutor.filter(call => call.request?.operation === 'analyze_message');
  const earlyIds = evidence.stages.before_goals.messages.map(row => row.id);
  assert.deepEqual(tutorAnalysis.filter(call => call.response?.data?.already_processed !== true)
    .map(call => call.request.message_id), earlyIds, 'Goal saving did not analyze early messages in order');
  assert(tutorAnalysis.every(call => call.status === 200 && call.response?.ok === true), 'Goal replay API failed');
  assert.deepEqual(tutorAnalysis.filter(call => call.response?.data?.already_processed === true)
    .map(call => call.request.message_id), earlyIds, 'Goal replay did not confirm backend completion');
  assert(evidence.function_calls.learner.every(call => call.status === 200 && call.response?.ok === true),
    'Learner API failed');
  assert.equal([...evidence.function_calls.tutor, ...evidence.function_calls.learner]
    .filter(call => call.request?.operation === 'prepare_turn').length, 0, 'Unexpected tutor AI action');
  evidence.status = 'pass';
  save();
  return evidence;
};
