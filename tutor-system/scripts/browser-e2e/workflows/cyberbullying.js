#!/usr/bin/env node
// Covers Cyberbullying room creation, progress, human review, persona publication, ratings, observer access and exports.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { joinAs, openRoom, query, waitForMatch, screenshot, writeJson, sendStudentMessage, captureResponses, guardProject, managementQuery, TIMEOUT } = require('../browser-e2e-support');

module.exports = async function cyberbullying(ctx) {
  const { tutorPage, studentPage, appUrl, client, evidenceDir, runId } = ctx;
  const title = `Browser Cyberbullying ${runId}`;
  await tutorPage.goto(`${appUrl}/#/tutor`, { waitUntil: 'domcontentloaded' });
  await tutorPage.getByRole('button', { name: /Create a new Room/i }).click();
  await tutorPage.getByLabel('Practice', { exact: true }).selectOption('cyberbullying');
  await tutorPage.getByLabel('Situation', { exact: true }).selectOption('copilot-1');
  await tutorPage.getByLabel('Room Title').fill(title);
  const description = await tutorPage.getByLabel('Description').inputValue();
  await tutorPage.getByLabel('Description').fill('[browser-e2e-created] ' + description);
  const pendingCreate = tutorPage.waitForResponse(response => response.url().includes('/rest/v1/rooms') && response.request().method() === 'POST', { timeout: TIMEOUT });
  await tutorPage.getByRole('button', { name: /Create Room/i }).click();
  const created = await pendingCreate;
  assert.equal(created.status(), 201);
  const createdBody = await created.json();
  const room = Array.isArray(createdBody) ? createdBody[0] : createdBody;
  ctx.registerCreatedRoom(room.id);
  assert.equal(room.practice_type, 'cyberbullying');
  assert(room.scenario_config.initial_comments.length > 0);
  assert.equal(room.scenario_config.post.image, room.image_url);

  const stopTutor = await captureResponses(tutorPage, response => response.url().includes('/functions/v1/'));
  const stopStudent = await captureResponses(studentPage, response => response.url().includes('/functions/v1/'));
  let observerContext;
  let observerId;
  try {
    await openRoom(studentPage, appUrl, room.id);
    await openRoom(tutorPage, appUrl, room.id);
    const imageChecks = await tutorPage.evaluate(async () => {
      const manifest = await (await fetch('/cyberbullying/asset-manifest.json')).json();
      return Promise.all(manifest.assets.map(async asset => {
        const image = new Image();
        image.src = asset.path;
        await image.decode();
        return { path: asset.path, width: image.naturalWidth, height: image.naturalHeight };
      }));
    });
    assert.equal(imageChecks.length, 8);
    assert(imageChecks.every(image => image.width > 0 && image.height > 0), 'Imported images must decode in the browser');
    await tutorPage.waitForFunction(() => Array.from(document.querySelectorAll('.room-post img')).every(image => image.complete && image.naturalWidth > 0));
    const checklist = (await waitForMatch(() => query(client, 'session_checklists', '*', 'room_id', room.id),
      rows => rows.length === 1 && rows[0].target_version === 'cyberbullying_v1', 'canonical learner checklist'))[0];
    assert.equal(checklist.student_id, ctx.student.id);
    const targets = await query(client, 'checklist_items', '*', 'checklist_id', checklist.id);
    assert.equal(targets.length, 5);
    assert.equal(new Set(targets.map(item => item.target_key)).size, 5);
    await sendStudentMessage(studentPage, 'Making fun of Dylan can leave him hurt and embarrassed. Dylan, I can listen privately. Please stop these comments without insulting anyone. I will not like or share the meme because that spreads the harm. I can save screenshots, report the posts and ask a trusted teacher to help.');
    await waitForMatch(() => query(client, 'checklist_items', '*', 'checklist_id', checklist.id),
      rows => rows.some(item => item.status !== 'pending'), 'learner progress analysis');
    await tutorPage.locator('button.ai-generate-btn').click();
    const character = tutorPage.getByLabel('Character', { exact: true });
    await character.waitFor({ timeout: TIMEOUT });
    assert.equal(await tutorPage.getByText('Quick Adjust', { exact: true }).count(), 0);
    await character.selectOption('victim');
    const regenerated = tutorPage.waitForResponse(response => response.url().includes('/functions/v1/ai-api') && response.request().postDataJSON()?.operation === 'cyberbullying_suggest', { timeout: TIMEOUT });
    await tutorPage.getByRole('button', { name: 'Regenerate', exact: true }).click();
    assert.equal((await regenerated).status(), 200);
    await waitForMatch(() => character.isEnabled(), enabled => enabled, 'regeneration completed');
    assert.equal(await character.inputValue(), 'victim');
    await character.selectOption('older_peer');
    await tutorPage.getByRole('button', { name: /Copy to Input/i }).click();
    const edited = `Tutor reviewed support ${runId}`;
    await tutorPage.locator('textarea.comment-input-field').fill(edited);
    await tutorPage.locator('form.comment-input-form button[type="submit"]').click();
    const messages = await waitForMatch(() => query(client, 'messages', '*', 'room_id', room.id),
      rows => rows.some(message => message.content === edited), 'approved character message');
    const approved = messages.find(message => message.content === edited);
    assert.equal(approved.character, 'older_peer');
    assert.equal(approved.persona_name, 'Tom');
    assert.equal(approved.user_id, ctx.tutor.id);
    const reviews = await query(client, 'ai_suggestion_feedback', '*', 'room_id', room.id);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].raw_character, 'victim');
    assert.equal(reviews[0].final_character, 'older_peer');
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await studentPage.getByText(edited, { exact: true }).waitFor({ timeout: TIMEOUT });
    assert(await studentPage.locator('.comment-author-name').filter({ hasText: 'Tom' }).count() > 0);
    await sendStudentMessage(studentPage, 'Thank you. I will ask Dylan privately what support he wants.');
    const ratings = await waitForMatch(() => query(client, 'message_feedback', '*', 'room_id', room.id),
      rows => rows.some(row => row.message_id === approved.id), 'rating linked to approved character message');

    await tutorPage.locator('button.ai-generate-btn').click();
    await character.waitFor({ timeout: TIMEOUT });
    await tutorPage.getByRole('button', { name: 'Reject', exact: true }).click();
    await character.waitFor({ state: 'hidden', timeout: TIMEOUT });
    assert.equal((await query(client, 'messages', 'id,user_role', 'room_id', room.id)).filter(message => message.user_role === 'tutor').length, 1);

    const progressBeforeGuard = await query(client, 'checklist_items', 'id,status,understanding_level', 'checklist_id', checklist.id);
    tutorPage.once('dialog', dialog => dialog.accept());
    await tutorPage.getByTitle('Manually change Guard Mode', { exact: true }).click();
    await waitForMatch(() => query(client, 'rooms', 'guard_mode', 'id', room.id), rows => rows[0]?.guard_mode === true, 'manual Guard entry');
    const guardedText = 'I will forward the meme and laugh at Dylan so everyone joins in.';
    await sendStudentMessage(studentPage, guardedText);
    const guardedMessage = (await waitForMatch(() => query(client, 'messages', 'id,content', 'room_id', room.id),
      rows => rows.some(row => row.content === guardedText), 'Guard learner message')).find(row => row.content === guardedText);
    const readMarker = () => managementQuery(ctx.config, `select processing_state,event_payload from private.learning_event_inbox where dedupe_key='analysis:${guardedMessage.id}'`);
    const deferred = await waitForMatch(readMarker, rows => rows[0]?.processing_state === 'deferred_guard', 'Guard progress deferral');
    const progressDuringGuard = await query(client, 'checklist_items', 'id,status,understanding_level', 'checklist_id', checklist.id);
    assert.deepEqual(progressDuringGuard.sort((a,b) => a.id.localeCompare(b.id)), progressBeforeGuard.sort((a,b) => a.id.localeCompare(b.id)));
    await openRoom(tutorPage, appUrl, room.id);
    await tutorPage.getByText(guardedText, { exact: true }).waitFor({ timeout: TIMEOUT });
    await tutorPage.locator('button.ai-generate-btn').click();
    await character.waitFor({ timeout: TIMEOUT });
    await tutorPage.locator('.ai-suggestion-box').getByTitle('Deactivate Guard Mode', { exact: true }).click();
    await tutorPage.getByRole('button', { name: /Copy to Input/i }).click();
    const recoveryText = `Tutor reviewed recovery ${runId}`;
    await tutorPage.locator('textarea.comment-input-field').fill(recoveryText);
    await tutorPage.locator('form.comment-input-form button[type="submit"]').click();
    const recoveryMessage = (await waitForMatch(() => query(client, 'messages', '*', 'room_id', room.id),
      rows => rows.some(row => row.content === recoveryText), 'reviewed Guard recovery')).find(row => row.content === recoveryText);
    const recoveryReview = (await query(client, 'ai_suggestion_feedback', '*', 'room_id', room.id)).find(row => row.tutor_message_id === recoveryMessage.id);
    assert.equal(recoveryReview.raw_guard_mode, true);
    assert.equal(recoveryReview.final_guard_mode, false);
    assert.equal((await query(client, 'rooms', 'guard_mode', 'id', room.id))[0].guard_mode, false);
    const replayed = await waitForMatch(readMarker, rows => rows[0]?.processing_state === 'applied', 'Guard evidence replay');

    observerContext = await tutorPage.context().browser().newContext();
    await guardProject(observerContext);
    const observer = await observerContext.newPage();
    const observerName = `Cyber observer ${runId}`;
    await joinAs(observer, appUrl, observerName, 'student');
    observerId = (await query(client, 'users', 'id', 'display_name', observerName))[0].id;
    await openRoom(observer, appUrl, room.id);
    await observer.getByText(edited, { exact: true }).waitFor({ timeout: TIMEOUT });
    assert.equal((await query(client, 'session_checklists', 'student_id', 'room_id', room.id)).length, 1);
    assert.equal(await observer.locator('button.ai-generate-btn').count(), 0);

    await tutorPage.locator('button[title="Download Chat History"]').click();
    const pendingDownload = tutorPage.waitForEvent('download');
    await tutorPage.getByRole('button', { name: 'Complete Data (JSON)', exact: true }).click();
    const download = await pendingDownload;
    const exportPath = path.join(evidenceDir, 'cyberbullying-export.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    assert.equal(exported.learning_progress.target_version, 'cyberbullying_v1');
    assert.equal(exported.learning_progress.student_id, ctx.student.id);
    assert.equal(exported.messages.find(message => message.id === approved.id).character, 'older_peer');
    const snapshots = await Promise.all([
      screenshot(tutorPage, evidenceDir, 'cyberbullying-tutor'),
      screenshot(studentPage, evidenceDir, 'cyberbullying-learner'),
      screenshot(observer, evidenceDir, 'cyberbullying-observer'),
    ]);
    return { room, checklist, targets, approved, reviews, ratings, guard: { deferred, replayed, recoveryMessage, recoveryReview }, image_checks: imageChecks, export_path: exportPath, screenshots: snapshots };
  } finally {
    writeJson(path.join(evidenceDir, 'cyberbullying-tutor-provider.json'), await stopTutor());
    writeJson(path.join(evidenceDir, 'cyberbullying-learner-provider.json'), await stopStudent());
    if (observerContext) await observerContext.close();
    if (observerId) {
      const { error } = await client.from('users').delete().eq('id', observerId);
      if (error) throw error;
    }
  }
};
