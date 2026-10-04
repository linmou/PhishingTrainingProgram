#!/usr/bin/env node
// File: scripts/browser-e2e/workflows/guard-mode.js. Purpose: verify one student-tutor Guard journey with real AI decisions and persisted mode changes.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {
  openRoom, query, waitForMatch, captureResponses,
  writeJson, screenshot, TIMEOUT
} = require('../browser-e2e-support');

function decisionFrom(calls) {
  const content = [...calls].reverse().find((call) => call.status === 200 && call.response?.data?.content)
    ?.response.data.content;
  assert(content, 'Tutor provider returned no decision');
  const parsed = JSON.parse(content);
  assert(['guard', 'tutoring'].includes(parsed.decision?.mode), 'Tutor provider returned no valid participation mode');
  assert(parsed.response?.trim(), 'Tutor provider returned no learner-facing response');
  return parsed;
}

module.exports = async function guardMode(ctx) {
  const { tutorPage, studentPage, client, appUrl, evidenceDir } = ctx;
  const room = await ctx.existingRoom('guard-mode');
  await openRoom(tutorPage, appUrl, room.id);
  await openRoom(studentPage, appUrl, room.id);

  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await tutorPage.getByRole('button', { name: 'Manual Input' }).click();
  await tutorPage.getByRole('textbox', { name: 'Detection Areas' }).fill('A lock icon does not prove who owns the website');
  await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).fill('Open the real app independently');
  await tutorPage.locator('.manual-checklist-form button[type="submit"]').click();
  const checklist = (await waitForMatch(
    () => query(client, 'session_checklists', 'id,room_id', 'room_id', room.id),
    (rows) => rows.length === 1, 'Guard journey checklist'
  ))[0];
  const item = (await waitForMatch(
    () => query(client, 'checklist_items', 'id,area_text,status', 'checklist_id', checklist.id),
    (rows) => rows.length === 2, 'Guard journey targets'
  )).find((row) => row.area_text.startsWith('A lock icon'));
  assert(item, 'Detection target was not saved');

  const toggle = tutorPage.locator('button[title="Manually change Guard Mode"]');
  tutorPage.once('dialog', (dialog) => dialog.dismiss());
  await toggle.click();
  assert.equal((await query(client, 'rooms', 'active_response_mode', 'id', room.id))[0].active_response_mode, 'tutoring');
  tutorPage.once('dialog', (dialog) => dialog.accept());
  await toggle.click();
  await tutorPage.getByTitle('Security Supervisor').waitFor({ timeout: TIMEOUT });
  assert.equal((await query(client, 'rooms', 'active_response_mode,mode_change_source', 'id', room.id))[0].mode_change_source, 'manual_override');
  const itemView = tutorPage.locator('.checklist-item').filter({ hasText: 'A lock icon does not prove' });
  await itemView.locator('.checklist-item-header').click();
  assert.equal(await itemView.locator('.status-select').isDisabled(), true);
  await studentPage.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await studentPage.getByTitle('Security Supervisor').count(), 0, 'Student inherited the tutor Guard identity');
  tutorPage.once('dialog', (dialog) => dialog.accept());
  await toggle.click();
  await tutorPage.locator('.comment-input-profile .comment-input-author-name').filter({ hasText: ctx.tutor.display_name }).waitFor({ timeout: TIMEOUT });
  assert.equal((await query(client, 'rooms', 'active_response_mode', 'id', room.id))[0].active_response_mode, 'tutoring');

  const turns = [];
  async function reviewedTurn(studentText, expectedMode) {
    await studentPage.locator('textarea.comment-input-field').fill(studentText);
    await studentPage.locator('form.comment-input-form button[type="submit"]').click();
    await studentPage.waitForFunction(() =>
      document.querySelector('textarea.comment-input-field')?.value === '' ||
      document.querySelector('[data-testid="rating-reminder-backdrop"]') !== null);
    const reminder = studentPage.getByRole('alertdialog', { name: 'Rate the previous response' });
    if (await reminder.isVisible()) {
      await reminder.getByRole('button', { name: 'Helpful', exact: true }).click();
      await reminder.getByRole('button', { name: '4 stars' }).click();
      await reminder.getByRole('button', { name: 'Submit rating' }).click();
      await reminder.waitFor({ state: 'hidden', timeout: TIMEOUT });
      await studentPage.locator('form.comment-input-form button[type="submit"]').click();
    }
    await studentPage.waitForFunction(() => document.querySelector('textarea.comment-input-field')?.value === '');
    const studentMessage = (await waitForMatch(
      () => query(client, 'messages', 'id,content,user_id', 'room_id', room.id),
      (rows) => rows.some((row) => row.user_id === ctx.student.id && row.content === studentText),
      'student Guard journey message'
    )).find((row) => row.user_id === ctx.student.id && row.content === studentText);
    await openRoom(tutorPage, appUrl, room.id);
    // The tutor tab polls asynchronously. Reload after the learner turn so the
    // generate action resolves the latest student message, not a stale one.
    await tutorPage.reload({ waitUntil: 'domcontentloaded' });
    await tutorPage.locator('.post-comment').filter({ hasText: studentText }).last().waitFor({ timeout: TIMEOUT });
    const checklistClose = tutorPage.locator('.checklist-close');
    if (await checklistClose.isVisible()) await checklistClose.click();
    const before = (await query(client, 'rooms', 'active_response_mode', 'id', room.id))[0].active_response_mode;
    const stop = await captureResponses(tutorPage, (response) => response.url().includes('/functions/v1/ai-api') || response.url().includes('/functions/v1/assessment-api'));
    let calls;
    try {
      await tutorPage.locator('button.ai-generate-btn').click();
      await tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().waitFor({ timeout: TIMEOUT });
      await tutorPage.waitForFunction(() => {
        const value = document.querySelector('.ai-suggestion-box .ai-suggestion-content p')?.textContent?.trim();
        return value && value !== 'Generating new response...';
      }, null, { timeout: TIMEOUT });
    } finally { calls = await stop(); }
    writeJson(path.join(evidenceDir, `guard-mode-provider-${turns.length + 1}.json`), calls);
    const decision = decisionFrom(calls);
    assert.equal(decision.decision.mode, expectedMode, `Unexpected AI mode for: ${studentText}`);
    assert.equal((await query(client, 'rooms', 'active_response_mode', 'id', room.id))[0].active_response_mode,
      before, 'An unreviewed suggestion changed the room mode');
    await tutorPage.getByRole('button', { name: /copy to input/i }).click();
    const reviewed = await tutorPage.locator('textarea.comment-input-field').inputValue();
    assert.equal(reviewed, decision.response);
    await tutorPage.locator('form.comment-input-form button[type="submit"]').click();
    const message = (await waitForMatch(
      () => query(client, 'messages', 'id,content,parent_message_id,response_mode,user_role', 'room_id', room.id),
      (rows) => rows.some((row) => row.parent_message_id === studentMessage.id && row.user_role === 'tutor'),
      'reviewed tutor Guard message'
    )).find((row) => row.parent_message_id === studentMessage.id && row.user_role === 'tutor');
    const feedback = (await waitForMatch(
      () => query(client, 'ai_suggestion_feedback', 'id,tutor_message_id,raw_mode,final_mode,tutor_final_response', 'room_id', room.id),
      (rows) => rows.some((row) => row.tutor_message_id === message.id),
      'reviewed Guard feedback'
    )).find((row) => row.tutor_message_id === message.id);
    assert.equal(message.response_mode, expectedMode);
    assert.equal(feedback.raw_mode, expectedMode);
    assert.equal(feedback.final_mode, expectedMode);
    assert.equal(feedback.tutor_final_response, reviewed);
    assert.equal((await query(client, 'rooms', 'active_response_mode', 'id', room.id))[0].active_response_mode, expectedMode);
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await studentPage.locator('.post-comment').filter({ hasText: reviewed }).waitFor({ timeout: TIMEOUT });
    turns.push({ student_message: studentMessage, decision, provider_calls: calls, tutor_message: message, feedback });
  }

  await reviewedTurn('I know a lock icon does not prove who owns the site, but I refuse to check the website name. I will trust the lock anyway.', 'guard');
  const guardProgress = (await query(client, 'checklist_items', 'status', 'id', item.id))[0].status;
  await reviewedTurn('Okay, I promise I will try later.', 'guard');
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  const lockedItem = tutorPage.locator('.checklist-item').filter({ hasText: 'A lock icon does not prove' });
  await lockedItem.locator('.checklist-item-header').click();
  assert.equal(await tutorPage.locator('.comment-input-profile .comment-input-author-name').filter({ hasText: 'Security Supervisor' }).count(), 1);
  assert.equal(await lockedItem.locator('.status-select').isDisabled(), true);
  assert.equal((await query(client, 'checklist_items', 'status', 'id', item.id))[0].status, guardProgress,
    'Guard changed checklist progress');
  await reviewedTurn('I want to try now: the lock only protects the connection. How do I check whether this is the real website?', 'tutoring');
  await tutorPage.locator('.comment-input-profile .comment-input-author-name').filter({ hasText: ctx.tutor.display_name }).waitFor({ timeout: TIMEOUT });
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  const restoredItem = tutorPage.locator('.checklist-item').filter({ hasText: 'A lock icon does not prove' });
  await restoredItem.locator('.checklist-item-header').click();
  assert.equal(await restoredItem.locator('.status-select').isDisabled(), false);
  writeJson(path.join(evidenceDir, 'guard-mode-provider.json'), turns.map(({ provider_calls }) => provider_calls));
  return {
    room_id: room.id, checklist_id: checklist.id, item_id: item.id, turns,
    screenshots: [await screenshot(tutorPage, evidenceDir, 'guard-mode-tutor'),
      await screenshot(studentPage, evidenceDir, 'guard-mode-student')]
  };
};
