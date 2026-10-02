#!/usr/bin/env node
// Purpose: verify a real tutor suggestion is reviewed, sent, and audited in a template room.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, sendStudentMessage, waitForMatch, query, captureResponses, writeJson, screenshot, TIMEOUT } = require('../browser-e2e-support');

module.exports = async function tutorResponse(ctx) {
  const { tutorPage, studentPage, client, appUrl, evidenceDir } = ctx;
  const room = await ctx.existingRoom('tutor-response');
  const priorMessages = new Set((await query(client, 'messages', 'id', 'room_id', room.id)).map((row) => row.id));
  const priorAudits = new Set((await query(client, 'ai_suggestion_feedback', 'id', 'room_id', room.id)).map((row) => row.id));
  await openRoom(studentPage, appUrl, room.id);
  await sendStudentMessage(studentPage, 'This warning claims my account will close soon. Should I use its link?');
  await waitForMatch(() => query(client, 'messages', 'id,content', 'room_id', room.id),
    (rows) => rows.some((row) => !priorMessages.has(row.id)), 'new learner message');
  await openRoom(tutorPage, appUrl, room.id);
  const stop = await captureResponses(tutorPage, (response) => response.url().includes('/chat/completions'));
  let calls;
  try {
    await tutorPage.locator('button.ai-generate-btn').click();
    await tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().waitFor({ timeout: TIMEOUT });
    await tutorPage.waitForFunction(() => {
      const value = document.querySelector('.ai-suggestion-box .ai-suggestion-content p')?.textContent?.trim();
      return value && value !== 'Generating new response...';
    }, null, { timeout: TIMEOUT });
  } finally { calls = await stop(); }
  writeJson(path.join(evidenceDir, 'tutor-provider.json'), calls);
  assert(calls.some((call) => call.status === 200 && call.response?.choices?.[0]?.message?.content), 'Tutor provider call did not return content');
  const suggestion = await tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().innerText();
  await tutorPage.getByRole('button', { name: /copy to input/i }).click();
  assert.equal(await tutorPage.locator('textarea.comment-input-field').inputValue(), suggestion);
  await tutorPage.locator('form.comment-input-form button[type="submit"]').click();
  const audit = (await waitForMatch(
    () => query(client, 'ai_suggestion_feedback', 'id,room_id,tutor_action,ai_suggestion,tutor_final_response', 'room_id', room.id),
    (rows) => rows.some((row) => !priorAudits.has(row.id)), 'new tutor feedback'
  )).find((row) => !priorAudits.has(row.id));
  assert.equal(audit.tutor_final_response, suggestion);
  return { room_id: room.id, provider_calls: calls, suggestion, audit, screenshot: await screenshot(tutorPage, evidenceDir, 'tutor-response') };
};
