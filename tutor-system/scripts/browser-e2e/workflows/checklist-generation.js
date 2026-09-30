#!/usr/bin/env node
// Purpose: verify Smart Generate uses the real LLM and persists extracted targets.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, sendStudentMessage, waitForRow, waitForMatch, query, captureResponses, extractedTargets, writeJson, screenshot, TIMEOUT } = require('../staging-support');

module.exports = async function checklistGeneration(ctx) {
  const { tutorPage, studentPage, client, appUrl, evidenceDir } = ctx;
  const room = await ctx.existingRoom('checklist-generation');
  await openRoom(studentPage, appUrl, room.id);
  await sendStudentMessage(studentPage, 'The alert feels urgent, but I can check my account in the official app.');
  await openRoom(tutorPage, appUrl, room.id);
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  const stop = await captureResponses(tutorPage, (response) => response.url().includes('/chat/completions'));
  let calls;
  try {
    await tutorPage.getByRole('button', { name: 'Smart Generate' }).click();
    await tutorPage.locator('.checklist-section, .manual-checklist-input').first().waitFor({ timeout: TIMEOUT });
  } finally { calls = await stop(); }
  writeJson(path.join(evidenceDir, 'checklist-generation-provider.json'), calls);
  const extracted = extractedTargets(calls);
  assert(extracted.length >= 2, 'Checklist provider returned no usable extraction');
  assert(extracted.some((item) => /urgenc|pressure/i.test(item)), 'Provider extraction lost the pressure cue');
  assert(extracted.some((item) => /official|manual login|do not click|don't click/i.test(item)), 'Provider extraction lost independent verification');
  const checklist = await waitForRow(client, 'session_checklists', 'id,room_id,template_name', 'room_id', room.id);
  const items = await waitForMatch(
    () => query(client, 'checklist_items', 'id,area_text,item_type', 'checklist_id', checklist.id),
    (rows) => rows.length >= 2, 'generated checklist items'
  );
  assert(items.length >= 2, 'Checklist extraction produced too few items');
  assert(items.some((item) => /urgenc|pressure/i.test(item.area_text)), 'Stored checklist lost the pressure cue');
  assert(items.some((item) => /official|manual login|do not click|don't click/i.test(item.area_text)), 'Stored checklist lost independent verification');
  return { room_id: room.id, provider_calls: calls, checklist, items, screenshot: await screenshot(tutorPage, evidenceDir, 'checklist-generation') };
};
