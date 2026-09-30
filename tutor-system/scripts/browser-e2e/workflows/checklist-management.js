#!/usr/bin/env node
// Purpose: verify tutor checklist creation, edits, and reload against staging records.
'use strict';

const assert = require('node:assert/strict');
const { openRoom, query, waitForRow, waitForMatch, screenshot } = require('../staging-support');

module.exports = async function checklistManagement(ctx) {
  const { tutorPage, client, appUrl, evidenceDir } = ctx;
  const room = await ctx.existingRoom('checklist-management');
  await openRoom(tutorPage, appUrl, room.id);
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await tutorPage.getByRole('button', { name: 'Manual Input' }).click();
  await tutorPage.getByRole('textbox', { name: 'Detection Areas' }).fill('Urgent account warning');
  await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).fill('Open the official app');
  await tutorPage.locator('.manual-checklist-form button[type="submit"]').click();
  const checklist = await waitForRow(client, 'session_checklists', 'id,room_id,template_name', 'room_id', room.id);
  const items = await waitForMatch(
    () => query(client, 'checklist_items', 'id,area_text,status,priority', 'checklist_id', checklist.id),
    (rows) => rows.length === 2, 'two manually created checklist items'
  );
  const item = items.find((row) => row.area_text === 'Urgent account warning');
  assert(item, 'Manual detection target was not stored');
  const itemView = tutorPage.locator('.checklist-item').filter({ hasText: 'Urgent account warning' });
  await itemView.locator('.checklist-item-header').click();
  await itemView.locator('.status-select').selectOption('covered');
  await waitForMatch(
    () => query(client, 'checklist_items', 'status', 'id', item.id),
    (rows) => rows[0]?.status === 'covered', 'covered status'
  );
  if (!(await itemView.locator('.priority-select').isVisible())) {
    await itemView.locator('.checklist-item-header').click();
  }
  await itemView.locator('.priority-select').selectOption('critical');
  await waitForMatch(
    () => query(client, 'checklist_items', 'priority', 'id', item.id),
    (rows) => rows[0]?.priority === 'critical', 'critical priority'
  );
  if (!(await itemView.locator('.edit-text-button').isVisible())) {
    await itemView.locator('.checklist-item-header').click();
  }
  await itemView.locator('.edit-text-button').click();
  await itemView.locator('.text-edit-input').fill('Recognize urgent account pressure');
  await itemView.locator('.save-text').click();
  const updated = await waitForMatch(
    () => query(client, 'checklist_items', 'id,area_text,status,priority', 'id', item.id),
    (rows) => rows[0]?.area_text === 'Recognize urgent account pressure' && rows[0]?.status === 'covered' && rows[0]?.priority === 'critical',
    'persisted checklist edits'
  );
  await tutorPage.reload({ waitUntil: 'domcontentloaded' });
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  const restored = tutorPage.locator('.checklist-item').filter({ hasText: 'Recognize urgent account pressure' });
  await restored.waitFor();
  await restored.locator('.checklist-item-header').click();
  assert.equal(await restored.locator('.status-select').inputValue(), 'covered');
  assert.equal(await restored.locator('.priority-select').inputValue(), 'critical');
  return { room_id: room.id, checklist_id: checklist.id, items, updated: updated[0], screenshot: await screenshot(tutorPage, evidenceDir, 'checklist-management') };
};
