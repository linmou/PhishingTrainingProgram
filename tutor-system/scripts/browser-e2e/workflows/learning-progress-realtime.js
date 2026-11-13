#!/usr/bin/env node
// Test responsibility: ChecklistPanel/useChecklist live cross-browser updates, draft preservation, membership promotion and reconnect recovery.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, query, waitForMatch, requestId, screenshot, writeJson, managementQuery, captureResponses, TIMEOUT } = require('../browser-e2e-support');

module.exports = async function learningProgressRealtime(ctx) {
  const { tutorPage, studentPage, client, appUrl } = ctx;
  const evidence = { status: 'running', started_at: new Date().toISOString(), rooms: [], checks: [], calls: [],
    latency_basis: 'Elapsed from successful mutation response; browser polling included; limit 2000ms.' };
  const persist = () => writeJson(path.join(ctx.evidenceDir, 'learning-progress-realtime.json'), evidence);
  const capture = response => /\/rest\/v1\/(sessions|session_checklists|checklist_items)\?|\/functions\/v1\/assessment-api/.test(response.url());
  const stopTutor = await captureResponses(tutorPage, capture);
  const stopLearner = await captureResponses(studentPage, capture);
  const panel = page => page.locator('.checklist-panel');
  const card = (page, target) => page.locator('.checklist-item').filter({ hasText: target });
  async function api(actor, operation, payload) {
    const body = { operation, request_id: requestId(), ...payload };
    const response = await fetch(`${ctx.config.projectUrl}/functions/v1/assessment-api`, {
      method: 'POST', headers: { apikey: ctx.config.anonKey, Authorization: `Bearer ${ctx.config.anonKey}`,
        'Content-Type': 'application/json', 'x-application-user-id': actor,
        'x-practice-contract': 'cyberbullying-v2' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    const payloadResult = await response.json();
    evidence.calls.push({ operation, request_id: body.request_id, status: response.status, error: payloadResult.error,
      ...(operation === 'join_room' ? { result: payloadResult.data } : {}) }); persist();
    assert.equal(response.status, 200, `${operation} failed`);
    assert.equal(payloadResult.ok, true, `${operation} rejected`);
    return payloadResult.data;
  }
  async function visibleWithin(label, locators, started, limit = 2000) {
    await Promise.all(locators.map(locator => locator.waitFor({ state: 'visible', timeout: limit })));
    const elapsed = Date.now() - started;
    evidence.checks.push({ label, elapsed_ms: elapsed, limit_ms: limit }); persist();
    assert(elapsed <= limit, `${label}: ${elapsed}ms exceeds ${limit}ms`);
  }
  async function createRoom(suffix) {
    await tutorPage.goto(`${appUrl}/#/tutor`, { waitUntil: 'domcontentloaded' });
    await tutorPage.getByRole('button', { name: /Create a new Room/i }).click();
    await tutorPage.getByLabel('Use Template').selectOption({ label: 'Account Security Alert Scam' });
    await tutorPage.getByLabel('Room Title').fill(`Browser realtime ${suffix} ${ctx.runId}`);
    await tutorPage.getByLabel('Description').fill('[browser-e2e-created] Learning progress realtime acceptance');
    const pending = tutorPage.waitForResponse(response => response.url().includes('/rest/v1/rooms') && response.request().method() === 'POST', { timeout: TIMEOUT });
    await tutorPage.getByRole('button', { name: /Create Room/i }).click();
    const response = await pending;
    assert.equal(response.status(), 201);
    const body = await response.json();
    const room = Array.isArray(body) ? body[0] : body;
    ctx.registerCreatedRoom(room.id);
    evidence.rooms.push({ id: room.id, case: suffix }); persist();
    assert.equal(room.transfer_learning_enabled, true);
    return room;
  }
  async function join(room) {
    await api(ctx.student.id, 'join_room', { room_id: room.id });
    await studentPage.goto(`${appUrl}/#/room/${room.id}`, { waitUntil: 'domcontentloaded' });
    await studentPage.locator('.room-post').waitFor({ timeout: TIMEOUT });
    await studentPage.locator('button[title="Learning Progress Checklist"]').click();
  }
  async function manual(target) {
    await tutorPage.getByRole('button', { name: 'Enter Manually', exact: true }).click();
    await tutorPage.getByRole('textbox', { name: 'Detection Areas' }).fill(target);
    await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).fill('Verify the sender through an independent trusted channel.');
    await tutorPage.locator('.manual-checklist-form button[type="submit"]').click();
    await card(tutorPage, target).waitFor({ timeout: TIMEOUT });
  }
  async function storedItem(room, target) {
    const checklists = await waitForMatch(() => query(client, 'session_checklists', 'id,is_active,student_id', 'room_id', room.id),
      rows => rows.some(row => row.is_active && row.student_id === ctx.student.id), 'learner checklist');
    const checklist = checklists.find(row => row.is_active && row.student_id === ctx.student.id);
    return (await waitForMatch(() => query(client, 'checklist_items', '*', 'checklist_id', checklist.id),
      rows => rows.some(row => row.area_text === target), 'persisted target')).find(row => row.area_text === target);
  }
  await studentPage.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__progressTestSockets = [];
    window.__progressTestAcks = [];
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        if (String(args[0]).includes('/realtime/')) {
          window.__progressTestSockets.push(this);
          this.addEventListener('message', event => {
            try {
              const message = JSON.parse(event.data);
              if (message.event === 'phx_reply' && message.payload?.status === 'ok' &&
                  Array.isArray(message.payload?.response?.postgres_changes) &&
                  message.payload.response.postgres_changes.some(change => change.table === 'checklist_items')) {
                window.__progressTestAcks.push(message);
              }
            } catch { /* Ignore non-JSON transport messages. */ }
          });
        }
      }
    };
  });
  // The runner has already loaded this origin; hash navigation does not run init scripts.
  await studentPage.reload({ waitUntil: 'domcontentloaded' });
  persist();
  try {
    const room = await createRoom('after-join');
    await join(room);
    await openRoom(tutorPage, appUrl, room.id);
    await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    const target = `Identify suspicious sender addresses ${ctx.runId}`;
    await manual(target);
    await card(studentPage, target).waitFor({ timeout: TIMEOUT });
    const item = await storedItem(room, target);
    evidence.rooms[0].item_id = item.id;
    const tutorCard = card(tutorPage, target);
    const learnerCard = card(studentPage, target);
    await tutorCard.locator('.checklist-item-header').click();
    await learnerCard.locator('.checklist-item-header').click();
    assert.equal(await panel(studentPage).locator('select,input,textarea,.edit-text-button,.edit-note-button,.save-text,.save-note').count(), 0,
      'Learner progress panel exposes mutation controls');
    await tutorCard.locator('.edit-text-button').click();
    await tutorCard.locator('.text-edit-input').fill('Unsaved local target draft');
    await tutorCard.locator('.edit-note-button').click();
    await tutorCard.locator('textarea').fill('Unsaved local tutor note');
    const edit = (action, updates) => api(ctx.tutor.id, 'edit_learning_progress', { room_id: room.id, item_id: item.id, action, updates });
    const changedPriority = item.priority === 'critical' ? 'optional' : 'critical';
    await edit('set_priority', { priority: changedPriority });
    await visibleWithin('remote priority updates both browsers', [tutorCard.locator(`.priority-badge.priority-${changedPriority}`), learnerCard.locator(`.priority-badge.priority-${changedPriority}`)], Date.now());
    await edit('set_status', { status: 'partially_covered' });
    await visibleWithin('remote status updates both browsers', [tutorCard.locator('.status-icon.partial'), learnerCard.locator('.status-icon.partial')], Date.now());
    assert.equal(await tutorCard.locator('.text-edit-input').inputValue(), 'Unsaved local target draft');
    assert.equal(await tutorCard.locator('textarea').inputValue(), 'Unsaved local tutor note');
    assert(await tutorCard.locator('.checklist-item-details').isVisible(), 'Expanded card collapsed');
    evidence.checks.push({ label: 'unsaved text/note and expansion survive remote priority/status', status: 'pass' });

    // Write only evidence; the database trigger supplies timestamp-only parent invalidation.
    const evidenceText = `Isolated evidence event ${ctx.runId}`;
    const itemBeforeEvidence = await query(client, 'checklist_items', '*', 'id', item.id);
    const literal = value => `'${String(value).replace(/'/g, "''")}'`;
    await managementQuery(ctx.config, `
      BEGIN;
      SET LOCAL ROLE service_role;
      SELECT set_config('request.headers', '{"x-practice-contract":"cyberbullying-v2"}', true);
      SELECT set_config('app.transfer_operation', 'on', true);
      INSERT INTO public.coverage_evidence(item_id,evidence_text,analysis,confidence_score,detection_method)
      VALUES (${literal(item.id)}::uuid,${literal(evidenceText)},
        'Fixture diagnostic for evidence-only subscription delivery.',80,'tutor_manual') RETURNING *;
      COMMIT;`);
    const evidenceCommitted = Date.now();
    const inserted = (await query(client, 'coverage_evidence', '*', 'item_id', item.id))
      .filter(row => row.evidence_text === evidenceText);
    assert.equal(inserted.length, 1);
    evidence.evidence_fixture = { mutation: 'isolated SQL INSERT under service_role and normal transfer-write context; trigger supplies parent invalidation', row: inserted[0] }; persist();
    await visibleWithin('isolated evidence visible in both browsers', [tutorCard.locator('.evidence-text').filter({ hasText: evidenceText }), learnerCard.locator('.evidence-text').filter({ hasText: evidenceText })], evidenceCommitted);
    const itemAfterEvidence = await query(client, 'checklist_items', '*', 'id', item.id);
    const withoutTimestamp = rows => rows.map(({ updated_at, ...row }) => row);
    assert.deepEqual(withoutTimestamp(itemAfterEvidence), withoutTimestamp(itemBeforeEvidence),
      'Evidence-only notification changed parent progress or content');
    assert.notEqual(itemAfterEvidence[0].updated_at, itemBeforeEvidence[0].updated_at,
      'Evidence-only notification did not invalidate the parent timestamp');
    await tutorCard.locator('.evidence-button').click();
    await edit('set_understanding', { understanding_level: 'good' });
    await visibleWithin('open evidence view refreshes understanding', [tutorPage.getByRole('dialog', { name: 'Learning Evidence' }).locator('.understanding-good'), learnerCard.locator('.understanding-good')], Date.now());
    assert(await tutorPage.getByRole('dialog', { name: 'Learning Evidence' }).getByText(evidenceText, { exact: false }).isVisible());
    await tutorPage.getByRole('button', { name: 'Close evidence', exact: true }).click();
    assert.equal(await tutorCard.locator('textarea').inputValue(), 'Unsaved local tutor note');
    assert.equal(await tutorCard.locator('.text-edit-input').inputValue(), 'Unsaved local target draft');

    await studentPage.locator('.checklist-close').click();
    await edit('set_priority', { priority: 'important' });
    await studentPage.locator('button[title="Learning Progress Checklist"]').click();
    await visibleWithin('hidden panel catches up on reopen', [learnerCard.locator('.priority-badge.priority-important')], Date.now());
    await studentPage.waitForFunction(() => window.__progressTestSockets.some(socket => socket.readyState === WebSocket.OPEN), undefined, { timeout: TIMEOUT });
    await studentPage.waitForFunction(() => window.__progressTestAcks.length > 0, undefined, { timeout: TIMEOUT });
    const acknowledgementsBeforeDisconnect = await studentPage.evaluate(() => window.__progressTestAcks.length);
    await studentPage.context().setOffline(true);
    await studentPage.evaluate(() => window.__progressTestSockets.forEach(socket => socket.close()));
    await studentPage.waitForFunction(() => window.__progressTestSockets.every(socket => socket.readyState === WebSocket.CLOSED), undefined, { timeout: TIMEOUT });
    await edit('set_status', { status: 'needs_review' });
    assert.equal(await learnerCard.locator('.status-icon.review').count(), 0, 'Disconnected learner received the update');
    await studentPage.context().setOffline(false);
    await visibleWithin('reconnect restores missed persisted state without reload', [learnerCard.locator('.status-icon.review')], Date.now(), TIMEOUT);
    await studentPage.waitForFunction(previous => window.__progressTestAcks.length > previous,
      acknowledgementsBeforeDisconnect, { timeout: TIMEOUT });
    await edit('set_priority', { priority: 'optional' });
    await visibleWithin('rejoined channel delivers a new mutation while continuously online',
      [learnerCard.locator('.priority-badge.priority-optional')], Date.now());
    evidence.screenshot = await screenshot(tutorPage, ctx.evidenceDir, 'learning-progress-realtime');

    await ctx.detachRooms();
    const preEntry = await createRoom('before-join');
    await openRoom(tutorPage, appUrl, preEntry.id);
    await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    const draftTarget = `Verify local draft promotion ${ctx.runId}`;
    await manual(draftTarget);
    assert.equal((await query(client, 'session_checklists', 'id', 'room_id', preEntry.id)).length, 0, 'Pre-entry checklist unexpectedly persisted');
    await join(preEntry);
    await card(studentPage, draftTarget).waitFor({ timeout: TIMEOUT });
    const promoted = await storedItem(preEntry, draftTarget);
    evidence.rooms[1].item_id = promoted.id;
    assert.equal((await query(client, 'messages', 'id,user_id', 'room_id', preEntry.id)).filter(row => row.user_id === ctx.student.id).length, 0,
      'Promotion relied on a learner message');
    evidence.checks.push({ label: 'local draft automatically promoted on learner membership before first message', status: 'pass' });
    evidence.status = 'pass';
  } catch (error) {
    evidence.status = 'fail'; evidence.error = { message: error.message, stack: error.stack }; throw error;
  } finally {
    await studentPage.context().setOffline(false);
    evidence.final_database = await Promise.all(evidence.rooms.map(async room => ({
      room_id: room.id,
      sessions: await query(client, 'sessions', 'id,student_id,tutor_id,status', 'room_id', room.id),
      checklists: await query(client, 'session_checklists', 'id,student_id,is_active,progress_policy_version', 'room_id', room.id),
    })));
    evidence.browser_requests = { tutor: await stopTutor(), learner: await stopLearner() };
    evidence.local_draft = await tutorPage.evaluate(roomIds => Object.fromEntries(
      Object.entries(localStorage).filter(([key]) => roomIds.some(id => key.includes(id)))
    ), evidence.rooms.map(room => room.id));
    evidence.completed_at = new Date().toISOString(); persist();
  }
  return evidence;
};
