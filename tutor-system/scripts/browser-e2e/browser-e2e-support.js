#!/usr/bin/env node
// Purpose: share existing-room browser actions and evidence for workflow tests.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const TARGET = process.env.E2E_TARGET || 'staging';
const PROJECT = process.env.E2E_PROJECT_REF || (TARGET === 'production' ? 'zgbufaxooqxeabewktzd' : 'ciubrzggdqesgvfkpolj');
const PROJECT_URL = process.env.E2E_SUPABASE_URL || `https://${PROJECT}.supabase.co`;
const FIXTURE_VERSION = 4;
const TIMEOUT = 90000;
const tutorRoot = path.resolve(__dirname, '../..');
const STAGING_ROOMS = Object.freeze({
  'tutor-response': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'checklist-generation': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'checklist-management': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'checklist-coverage': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'guard-mode': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'assessment-delivery': { id: '286de02f-30b0-46ee-8df3-17d1dae1ca89', title: 'Transfer Assessment Demo: Account Warning' },
  'assessment-answer-pass': { id: 'd6b6b8f0-c0f8-4a4f-a55f-6c9f776221dd', title: 'Transfer Assessment Demo: Account Warning' },
  'assessment-answer-failure': { id: '79be49a2-e53c-493d-bd66-adcffbadbba5', title: 'Transfer Assessment Demo: Account Warning' }
});
const PRODUCTION_ROOMS = Object.freeze({
  'tutor-response': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'checklist-generation': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'checklist-management': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'checklist-coverage': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'guard-mode': { id: '3630671f-b40d-48ed-b28b-e1da6d407436', title: 'Demo: Click Impulse' },
  'assessment-delivery': { id: '286de02f-30b0-46ee-8df3-17d1dae1ca89', title: 'Transfer Assessment Demo: Account Warning' },
  'assessment-answer-pass': { id: 'd6b6b8f0-c0f8-4a4f-a55f-6c9f776221dd', title: 'Transfer Assessment Demo: Account Warning' },
  'assessment-answer-failure': { id: '79be49a2-e53c-493d-bd66-adcffbadbba5', title: 'Transfer Assessment Demo: Account Warning' }
});
function roomFixtures(env = process.env) {
  if (!env.E2E_ROOM_FIXTURES_JSON) return (env.E2E_TARGET || TARGET) === 'production' ? PRODUCTION_ROOMS : STAGING_ROOMS;
  let fixtures;
  try { fixtures = JSON.parse(env.E2E_ROOM_FIXTURES_JSON); } catch { throw new Error('E2E_ROOM_FIXTURES_JSON must be valid JSON'); }
  if (!fixtures || typeof fixtures !== 'object' || Array.isArray(fixtures)) throw new Error('E2E_ROOM_FIXTURES_JSON must be an object');
  return Object.freeze(fixtures);
}
const ROOMS = roomFixtures();

function configFromEnv(env = process.env) {
  const appUrl = env.E2E_APP_URL;
  const target = env.E2E_TARGET || 'staging';
  const projectRef = env.E2E_PROJECT_REF || (target === 'production' ? 'zgbufaxooqxeabewktzd' : 'ciubrzggdqesgvfkpolj');
  const projectUrl = env.E2E_SUPABASE_URL || (target === 'production' ? env.REACT_APP_SUPABASE_URL : env.REACT_APP_SUPABASE_STAGING_URL);
  const anonKey = env.E2E_SUPABASE_ANON_KEY || (target === 'production' ? env.REACT_APP_SUPABASE_ANON_KEY : env.REACT_APP_SUPABASE_STAGING_ANON_KEY);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = env.SUPABASE_ACCESS_TOKEN;
  if (!appUrl || !projectUrl || !anonKey || !serviceKey || !accessToken) {
    throw new Error('Set E2E_APP_URL, E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ACCESS_TOKEN.');
  }
  const expectedProjectUrl = `https://${projectRef}.supabase.co`;
  if (new URL(projectUrl).origin !== expectedProjectUrl || projectUrl.replace(/\/$/, '') !== expectedProjectUrl ||
      new URL(projectUrl).hostname !== `${projectRef}.supabase.co`) {
    throw new Error(`Browser E2E project URL does not match ${projectRef}.`);
  }
  if (serviceKey === anonKey) throw new Error('The service-role key must differ from the anon key.');
  const origin = new URL(appUrl);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.hash || origin.pathname !== '/') {
    throw new Error('E2E_APP_URL must be an HTTP(S) origin without credentials or a hash.');
  }
  return { appUrl: origin.origin, projectUrl: expectedProjectUrl, anonKey, serviceKey, accessToken, projectRef };
}

function guardProject(context) {
  const seen = new Set();
  const rejected = [];
  return context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith('.supabase.co')) {
      if (url.origin !== PROJECT_URL) {
        rejected.push(url.origin);
        return route.abort('blockedbyclient');
      }
      seen.add(url.origin);
    }
    return route.continue();
  }).then(() => ({ seen, rejected }));
}

function assertProjectTraffic(traffic) {
  assert.deepEqual(traffic.rejected, [], 'App attempted to reach another Supabase project');
  assert(traffic.seen.has(PROJECT_URL), `App made no ${PROJECT} Supabase request`);
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function query(client, table, columns, field, value) {
  const { data, error } = await client.from(table).select(columns).eq(field, value);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

async function insert(client, table, row) {
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function waitForRow(client, table, columns, field, value) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = await query(client, table, columns, field, value);
    if (rows.length) return rows[0];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${table}.${field}=${value}`);
}

async function waitForMatch(read, matches, label) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await read();
    if (matches(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function joinAs(page, appUrl, name, role) {
  await page.goto(`${appUrl}/#/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#displayName').fill(name);
  await page.locator(`input[name="role"][value="${role}"]`).check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(new RegExp(`#/${role === 'tutor' ? 'tutor' : 'student'}`), { timeout: TIMEOUT });
}

async function openRoom(page, appUrl, roomId) {
  await page.goto(`${appUrl}/#/room/${roomId}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.room-post').waitFor({ state: 'visible', timeout: TIMEOUT });
}

async function sendStudentMessage(page, content) {
  const reminder = page.locator('[data-testid="rating-reminder-backdrop"]');
  const input = page.locator('textarea.comment-input-field');
  const send = page.locator('form.comment-input-form button[type="submit"]');
  const completeRating = async () => {
    await reminder.locator('.rating-reminder-choice button').first().click();
    await reminder.locator('.rating-reminder-stars button').nth(3).click();
    await reminder.locator('.rating-reminder-submit').click();
    await reminder.waitFor({ state: 'hidden', timeout: TIMEOUT });
  };

  if (await reminder.isVisible()) await completeRating();
  await input.fill(content);
  await send.click();
  await page.waitForFunction(() =>
    document.querySelector('textarea.comment-input-field')?.value === '' ||
    document.querySelector('[data-testid="rating-reminder-backdrop"]') !== null,
  null, { timeout: TIMEOUT });
  if (await reminder.isVisible()) {
    await completeRating();
    await send.click();
    await page.waitForFunction(() => document.querySelector('textarea.comment-input-field')?.value === '',
      null, { timeout: TIMEOUT });
  }
}

async function existingRoom(client, kind, tutorId) {
  const expected = ROOMS[kind];
  if (!expected) throw new Error(`No existing template room is configured for ${kind}`);
  const room = (await query(client, 'rooms', 'id,title,description,tutor_id,is_active,ai_assistant_enabled,ai_assistant_prompt,pre_populated_dialogue,transfer_learning_enabled,active_response_mode,mode_changed_at,mode_change_source', 'id', expected.id))[0];
  assert(room && room.title === expected.title && room.tutor_id === tutorId && room.is_active && room.ai_assistant_enabled,
    `${TARGET} room ${expected.id} no longer matches the ${kind} fixture`);
  assert(room.ai_assistant_prompt && room.pre_populated_dialogue?.length > 0, `Room ${expected.id} has no template content`);
  assert(room.description.includes('[browser-e2e-template]'), `Room ${expected.id} is not a browser fixture`);
  assert.equal(room.transfer_learning_enabled, kind.startsWith('assessment-'), `Room ${expected.id} has the wrong transfer mode`);
  assert(room.active_response_mode === 'tutoring' && !room.mode_changed_at && !room.mode_change_source,
    `Room ${expected.id} still has response-mode state from a previous run`);
  for (const table of ['messages', 'session_checklists', 'sessions', 'ai_suggestion_feedback', 'message_feedback']) {
    const rows = await query(client, table, 'id', 'room_id', room.id);
    assert.equal(rows.length, 0, `Room ${expected.id} still has ${table} from a previous run`);
  }
  return room;
}

async function cleanupRoom(config, roomId) {
  assert(Object.values(ROOMS).some((room) => room.id === roomId), `Refusing to clean unconfigured room ${roomId}`);
  const rows = await managementQuery(config, `select description from public.rooms where id='${roomId}'::uuid`);
  assert(rows[0]?.description?.includes('[browser-e2e-template]'), `Refusing to clean non-template room ${roomId}`);
  await managementQuery(config, `do $$ begin
    update public.rooms set active_response_mode='tutoring',mode_changed_at=null,mode_change_source=null
      where id='${roomId}'::uuid;
    delete from private.transfer_assessment_attempts where assessment_id in
      (select id from private.transfer_assessments where room_id='${roomId}'::uuid);
    delete from private.transfer_provider_attempts where room_id='${roomId}'::uuid;
    delete from private.transfer_assessments where room_id='${roomId}'::uuid;
    delete from private.learning_event_inbox where room_id='${roomId}'::uuid;
    delete from public.ai_suggestion_feedback where room_id='${roomId}'::uuid;
    delete from public.message_feedback where room_id='${roomId}'::uuid;
    delete from public.sessions where room_id='${roomId}'::uuid;
    delete from public.session_checklists where room_id='${roomId}'::uuid;
    delete from public.messages where room_id='${roomId}'::uuid;
  end $$;`);
  for (const table of ['messages', 'session_checklists', 'sessions', 'ai_suggestion_feedback', 'message_feedback']) {
    const remaining = await managementQuery(config, `select count(*)::integer as count from public.${table} where room_id='${roomId}'::uuid`);
    assert.equal(remaining[0].count, 0, `Cleanup left ${table} in room ${roomId}`);
  }
  for (const table of ['transfer_assessments', 'transfer_provider_attempts', 'learning_event_inbox']) {
    const remaining = await managementQuery(config, `select count(*)::integer as count from private.${table} where room_id='${roomId}'::uuid`);
    assert.equal(remaining[0].count, 0, `Cleanup left private.${table} in room ${roomId}`);
  }
  const restored = await managementQuery(config, `select active_response_mode,mode_changed_at,mode_change_source from public.rooms where id='${roomId}'::uuid`);
  assert.equal(restored[0]?.active_response_mode, 'tutoring', `Cleanup left response mode in room ${roomId}`);
  assert.equal(restored[0]?.mode_changed_at, null, `Cleanup left mode timestamp in room ${roomId}`);
  assert.equal(restored[0]?.mode_change_source, null, `Cleanup left mode source in room ${roomId}`);
}

async function cleanupCreatedRoom(config, roomId, tutorId) {
  assert.match(roomId, /^[0-9a-f-]{36}$/i);
  assert.match(tutorId, /^[0-9a-f-]{36}$/i);
  const rows = await managementQuery(config,
    `select tutor_id,description from public.rooms where id='${roomId}'::uuid`);
  assert.equal(rows.length, 1, `Created room ${roomId} is missing`);
  assert.equal(rows[0].tutor_id, tutorId, `Refusing to delete room ${roomId} owned by another tutor`);
  assert(rows[0].description?.includes('[browser-e2e-created]'),
    `Refusing to delete room ${roomId} without the browser test marker`);
  const deleted = await managementQuery(config,
    `delete from public.rooms where id='${roomId}'::uuid and tutor_id='${tutorId}'::uuid returning id`);
  assert.equal(deleted.length, 1, `Failed to delete created room ${roomId}`);
}

async function captureResponses(page, predicate) {
  const pending = [];
  const records = [];
  const listener = (response) => {
    if (response.request().method() !== 'POST' || !predicate(response)) return;
    pending.push((async () => {
      let body;
      try { body = await response.json(); } catch { body = await response.text().catch(() => null); }
      records.push({ url: response.url(), status: response.status(), request: response.request().postDataJSON(), response: body });
    })());
  };
  page.on('response', listener);
  return async () => {
    page.off('response', listener);
    await Promise.all(pending);
    return records;
  };
}

function extractedTargets(calls) {
  for (const call of calls) {
    if (call.status !== 200 || !JSON.stringify(call.request).includes('Extract cybersecurity learning content')) continue;
    const content = call.response?.data?.content;
    if (typeof content !== 'string') continue;
    try {
      const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
      const items = [...(Array.isArray(parsed.understanding) ? parsed.understanding : []),
        ...(Array.isArray(parsed.behavior) ? parsed.behavior : [])];
      if (items.length >= 2 && items.every((item) => typeof item === 'string' && !/\]\s*none$/i.test(item))) return items;
    } catch { /* Invalid provider output is not an extraction result. */ }
  }
  return [];
}

async function managementQuery(config, sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${config.projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  if (!response.ok) throw new Error(`Staging SQL failed: HTTP ${response.status} ${await response.text()}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Staging SQL returned no row array');
  return rows;
}

async function screenshot(page, dir, name) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return path.basename(file);
}

function requestId() { return crypto.randomUUID(); }

module.exports = {
  TARGET, PROJECT, PROJECT_URL, ROOMS, FIXTURE_VERSION, TIMEOUT, tutorRoot, configFromEnv, guardProject,
  assertProjectTraffic, writeJson, query, insert, waitForRow, waitForMatch,
  joinAs, openRoom, sendStudentMessage, existingRoom, cleanupRoom, cleanupCreatedRoom, captureResponses, extractedTargets,
  managementQuery, screenshot, requestId
};
