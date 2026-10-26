#!/usr/bin/env node
// Purpose: measure staging room synchronization and feedback through the actual candidate browser app.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const appRequire = createRequire(path.resolve(__dirname, '../tutor-system/package.json'));
const { chromium } = appRequire('playwright');
const { createClient } = appRequire('@supabase/supabase-js');
const support = require('../tutor-system/scripts/browser-e2e/browser-e2e-support');
const { acquireFixtureLock } = require('../tutor-system/scripts/browser-e2e/fixture-lock');
const { acquireProjectLock } = require('./staging-coordination');

function settings(env = process.env) {
  const config = support.configFromEnv(env);
  assert.equal(env.E2E_TARGET, 'staging', 'Explicit E2E_TARGET=staging is required');
  assert.equal(config.projectRef, 'ciubrzggdqesgvfkpolj', 'Only the staging project is permitted');
  const windowMs = Number(env.PERF_WINDOW_MS || 60000);
  assert(Number.isInteger(windowMs) && windowMs >= 60000, 'PERF_WINDOW_MS must be an integer >= 60000');
  return { ...config, windowMs };
}

function summarize(records, started, ended) {
  const rows = records.filter(row => row.started_ms >= started && row.started_ms < ended);
  for (const row of rows) {
    assert(!row.failure, `Request failed: ${row.url}`);
    assert(!row.capture_error && Number.isInteger(row.response_body_bytes), `Missing response body: ${row.url}`);
    // First login probes a not-yet-created offline identity with PostgREST .single().
    let expectedIdentityMiss = false;
    if (row.pathname === '/rest/v1/users' && row.method === 'GET' && row.status === 406) {
      try { expectedIdentityMiss = JSON.parse(row.response_body).code === 'PGRST116'; } catch { /* Other errors remain failures. */ }
    }
    assert((row.status >= 200 && row.status < 300) || expectedIdentityMiss, `HTTP ${row.status}: ${row.url}`);
  }
  const messages = rows.filter(row => row.pathname === '/rest/v1/messages' && row.method === 'GET');
  const feedback = rows.filter(row => row.pathname === '/rest/v1/message_feedback' && row.method === 'GET');
  const metric = requests => ({ requests: requests.length,
    requests_per_minute: requests.length * 60000 / (ended - started),
    response_body_bytes: requests.reduce((sum, row) => sum + (row.response_body_bytes || 0), 0) });
  return { duration_ms: ended - started, messages: metric(messages), feedback: metric(feedback), all: metric(rows) };
}

function assertHealthy(summary, count) {
  assert(summary.duration_ms >= 60000, 'Healthy measurement requires at least 60 seconds');
  // A keyset scan has an extra empty page at exact page-size multiples.
  const pagesPerScan = Math.floor(count / 100) + 1;
  const maximumScans = Math.floor(summary.duration_ms / 60000) + 1;
  const maximumRequests = pagesPerScan * maximumScans;
  assert(summary.messages.requests <= maximumRequests,
    `Healthy message requests ${summary.messages.requests} exceed ${maximumRequests}`);
  assert.equal(summary.feedback.requests, 0, 'Unchanged healthy history must not reload feedback');
  return { pages_per_scan: pagesPerScan, maximum_scans: maximumScans, maximum_message_requests: maximumRequests };
}

function realtimeFrame(payload) {
  let frame;
  try { frame = JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : payload); }
  catch { return null; }
  if (!frame || typeof frame !== 'object') return null;
  const event = Array.isArray(frame) ? frame[3] : frame.event;
  const topic = Array.isArray(frame) ? frame[2] : frame.topic;
  const body = Array.isArray(frame) ? frame[4] : frame.payload;
  if (event === 'phx_reply' && Array.isArray(body?.response?.postgres_changes)) {
    return { topic, kind: 'bindings', status: body.status, bindings: body.response.postgres_changes };
  }
  if (event === 'system') return { topic, kind: 'system', payload: body };
  const data = body?.data;
  if (event !== 'postgres_changes' || !data?.table) return null;
  return { topic, kind: 'change', schema: data.schema, table: data.table,
    message_id: data.record?.id, event: data.type, record: data.record, old_record: data.old_record };
}

function messageFrame(payload) {
  const frame = realtimeFrame(payload);
  return frame?.table === 'messages' ? frame : null;
}

function frameMetadata(payload) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const metadata = { bytes: bytes.length, encoding: Buffer.isBuffer(payload) ? 'binary' : 'text',
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  try {
    const frame = JSON.parse(bytes.toString('utf8'));
    const event = Array.isArray(frame) ? frame[3] : frame?.event;
    const topic = Array.isArray(frame) ? frame[2] : frame?.topic;
    const body = Array.isArray(frame) ? frame[4] : frame?.payload;
    return { ...metadata, shape: Array.isArray(frame) ? 'array' : typeof frame,
      event: typeof event === 'string' && /^[a-z_]+$/.test(event) ? event : null,
      topic: typeof topic === 'string' && /^realtime:room_[0-9a-f-]+$/i.test(topic) ? topic : null,
      payload_keys: body && typeof body === 'object' ? Object.keys(body) : [],
      response_keys: body?.response && typeof body.response === 'object' ? Object.keys(body.response) : [] };
  } catch { return { ...metadata, shape: 'unparsed' }; }
}

function assertPublicPayload(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!['correct_option_ids', 'answer_key', 'reviewed_private_payload'].includes(key.toLowerCase()),
      `Private assessment key in realtime payload: ${key}`);
    if (key === 'schema') assert.notEqual(child, 'private', 'Private schema in realtime payload');
    assertPublicPayload(child);
  }
}

function assertBindings(events, roomId, started, ended) {
  const topic = `realtime:room_${roomId}`;
  const roomEvents = events.filter(row => row.topic === topic && row.received_ms >= started && row.received_ms <= ended);
  const expected = [['messages', 'INSERT'], ['messages', 'UPDATE'], ['message_feedback', 'INSERT'], ['message_feedback', 'UPDATE'], ['rooms', 'UPDATE']];
  const acknowledgement = roomEvents.find(row => row.kind === 'bindings' && row.status === 'ok' &&
    expected.every(([table, event]) => row.bindings.some(binding =>
      binding.schema === 'public' && binding.table === table && binding.event === event &&
      binding.filter === `${table === 'rooms' ? 'id' : 'room_id'}=eq.${roomId}`)));
  assert(acknowledgement, 'Room channel did not acknowledge all three public table bindings');
  const errors = roomEvents.filter(row => row.kind === 'system' && row.payload?.status === 'error');
  assert.deepEqual(errors, [], 'Room channel reported a system error');
  for (const row of roomEvents.filter(row => row.kind === 'change')) assertPublicPayload(row);
  return { acknowledgement, system_errors: errors, inspected_change_payloads: roomEvents.filter(row => row.kind === 'change').length };
}

async function waitForBindings(page, events, roomId, started, timeoutMs = 30000) {
  const waiting = Date.now();
  while (true) {
    const errors = events.filter(row => row.topic === `realtime:room_${roomId}` && row.received_ms >= started &&
      row.kind === 'system' && row.payload?.status === 'error');
    assert.deepEqual(errors, [], 'Room channel reported a system error while awaiting bindings');
    try {
      return { ...assertBindings(events, roomId, started, Date.now()), wait_ms: Date.now() - waiting, timeout_ms: timeoutMs };
    } catch (error) {
      if (!error.message.includes('did not acknowledge') || Date.now() - waiting >= timeoutMs) throw error;
    }
    await page.waitForTimeout(Math.min(100, timeoutMs));
  }
}

function assertRealtime(events, messageId, event, timing, table = 'messages') {
  const received = events.find(row => row.message_id === messageId && row.event === event &&
    (!row.table || row.table === table) &&
    row.received_ms >= timing.mutation_started_ms && row.received_ms <= timing.visible_ms);
  assert(received, `Missing incoming ${event} websocket event for ${messageId}`);
  assert(timing.after_write_ms <= 5000, `${event} visibility exceeded 5000ms after write`);
  return { ...timing, websocket_event: received, maximum_after_write_ms: 5000 };
}

function assertTargetedRefreshes(refreshes, messageId) {
  // Explicit submit, realtime/broadcast invalidation and a dirty in-flight follow-up may overlap.
  assert(refreshes.length >= 1 && refreshes.length <= 3,
    `Expected 1..3 targeted feedback refreshes, received ${refreshes.length}`);
  for (const refresh of refreshes) {
    assert.equal(new URL(refresh.url).searchParams.get('message_id'), `in.(${messageId})`,
      'Refresh must contain only the rated message');
  }
}

async function settleFeedback(page, records) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    const before = records.filter(row => row.pathname === '/rest/v1/message_feedback').length;
    await page.waitForTimeout(1000);
    const feedback = records.filter(row => row.pathname === '/rest/v1/message_feedback');
    if (feedback.length === before && feedback.every(row => row.completed_ms || row.failure)) return;
  }
  throw new Error('Feedback requests did not settle within 10000ms');
}

function monitor(page, records, events, frames = []) {
  const requests = new Map();
  const completions = new Map();
  const captures = new Map();
  let closed;
  const pageClosed = new Promise(resolve => { closed = resolve; });
  page.on('close', () => {
    for (const [request, row] of requests) {
      if (!row.finished_ms && !row.failure) {
        row.failure = { errorText: 'Page closed before request completion' };
        row.cancelled_at_close_ms = Date.now();
        completions.get(request).resolve();
      }
    }
    closed();
  });
  page.on('websocket', socket => {
    if (!socket.url().includes('/realtime/')) return;
    frames.push({ kind: 'socket_open', received_ms: Date.now(), origin: new URL(socket.url()).origin });
    socket.on('framereceived', ({ payload }) => {
      const frame = realtimeFrame(payload);
      frames.push({ kind: 'frame', received_ms: Date.now(), decoded: Boolean(frame), ...frameMetadata(payload) });
      if (frame) events.push({ ...frame, received_ms: Date.now() });
    });
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.hostname.endsWith('.supabase.co')) return;
    const row = { started_ms: Date.now(), url: request.url(), pathname: url.pathname,
      method: request.method(), request_body: request.postData() };
    requests.set(request, row);
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    completions.set(request, { promise, resolve });
    records.push(row);
  });
  page.on('response', response => {
    const row = requests.get(response.request());
    if (!row) return;
    captures.set(response.request(), (async () => {
      row.status = response.status();
      try {
        const body = await response.body();
        row.response_body_bytes = body.length;
        row.response_body = body.toString('utf8');
      } catch (error) { row.capture_error = String(error); }
      finally { row.completed_ms = Date.now(); }
    })());
  });
  page.on('requestfinished', request => {
    const row = requests.get(request);
    if (row) { row.finished_ms = Date.now(); completions.get(request).resolve(); }
  });
  page.on('requestfailed', request => {
    const row = requests.get(request);
    if (row) { row.failure = request.failure(); completions.get(request).resolve(); }
  });
  return async (boundary = Date.now() + 1) => {
    const included = [...requests.keys()].filter(request => requests.get(request).started_ms < boundary);
    let timer;
    try {
      await Promise.race([
        (async () => {
          await Promise.all(included.map(request => completions.get(request).promise));
          await Promise.race([Promise.all(included.map(request => captures.get(request))), pageClosed]);
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('HTTP measurement did not settle within 30000ms')), 30000); })
      ]);
    } finally { clearTimeout(timer); }
  };
}

async function insertRows(client, table, rows) {
  for (let offset = 0; offset < rows.length; offset += 100) {
    const { error } = await client.from(table).insert(rows.slice(offset, offset + 100));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function resetIdentity(page) {
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
}

function errorDetails(error) {
  if (!error || typeof error !== 'object') return { message: String(error) };
  return { ...error, message: error.message || String(error),
    ...(error.stack ? { stack: error.stack } : {}) };
}

function createFixtureClient(config, factory = createClient) {
  return factory(config.projectUrl, config.serviceKey, {
    global: { headers: { 'x-practice-contract': 'cyberbullying-v2' } },
    auth: { persistSession: false }
  });
}

function allowMembershipRequest(url, method, body) {
  if (new URL(url).pathname !== '/functions/v1/assessment-api' || method !== 'POST') return false;
  let payload;
  try { payload = JSON.parse(body); } catch { return false; }
  return payload?.operation === 'join_room' && typeof payload.room_id === 'string' && payload.room_id.length > 0;
}

function routeEdgeRequest(route, errors) {
  const request = route.request();
  if (allowMembershipRequest(request.url(), request.method(), request.postData())) return route.fallback();
  errors.push(`Unexpected provider/Edge request: ${new URL(request.url()).pathname}`);
  return route.abort('blockedbyclient');
}

async function visibility(page, text, mutate) {
  const started = Date.now();
  await mutate();
  const persisted = Date.now();
  await page.getByText(text, { exact: true }).waitFor({ timeout: 5000 });
  return { text, mutation_started_ms: started, mutation_completed_ms: persisted,
    visible_ms: Date.now(), end_to_end_ms: Date.now() - started, after_write_ms: Date.now() - persisted };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('Usage: E2E_TARGET=staging node scripts/measure-room-performance.cjs\nRequired: E2E_APP_URL, E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN.\nOptional: PTP_COORDINATION_LEASE (exact candidate lease), PERF_WINDOW_MS (default 60000).\nRuns histories 10/100/1000; creates tagged staging fixtures, blocks provider calls, cleans all fixtures, records output/playwright/room-performance-*/report.json.');
    return;
  }
  assert.equal(argv.length, 0, 'Only --help is accepted');
  const config = settings();
  const root = path.resolve(__dirname, '..');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const evidenceDir = path.join(root, 'output/playwright', `room-performance-${runId}`);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const report = { run_id: runId, commit, started_at: new Date().toISOString(), status: 'running',
    script_sha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    config: { target: 'staging', project_ref: config.projectRef, app_url: config.appUrl,
      histories: [10, 100, 1000], window_ms: config.windowMs, byte_metric: 'decoded HTTP response body bytes (excludes headers and websocket frames)' },
    users: [], rooms: [], histories: [], cleanup: [], requests: [], websocket_messages: [], websocket_frames: [], errors: [] };
  const save = () => support.writeJson(path.join(evidenceDir, 'report.json'), report);
  const client = createFixtureClient(config);
  let browser, fixtureLock, lease, flush;
  try {
    fixtureLock = acquireFixtureLock(config.projectRef, { runId });
    lease = acquireProjectLock(config.projectRef, { operation: 'room-performance', commit, runId, evidenceDir });
    report.coordination = { ref: lease.ref, tag_sha: lease.tag_sha, borrowed: lease.borrowed, owner: lease.owner };
    save();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const traffic = await support.guardProject(context);
    await context.route('**/functions/v1/**', route => routeEdgeRequest(route, report.errors));
    await context.addInitScript(() => {
      const NativeSocket = window.WebSocket;
      const sockets = new Set();
      window.__perfRealtimeBlocked = false;
      window.__perfDisconnectRealtime = () => {
        window.__perfRealtimeBlocked = true;
        let closed = 0;
        for (const socket of sockets) if (socket.url.includes('/realtime/')) { socket.close(); closed++; }
        return closed;
      };
      window.WebSocket = class extends NativeSocket {
        constructor(...args) {
          super(...args);
          sockets.add(this);
          this.addEventListener('close', () => sockets.delete(this));
          if (window.__perfRealtimeBlocked && this.url.includes('/realtime/')) setTimeout(() => this.close(), 0);
        }
      };
    });
    const page = await context.newPage();
    flush = monitor(page, report.requests, report.websocket_messages, report.websocket_frames);
    for (const role of ['tutor', 'student']) {
      const name = `Performance ${role} ${runId}`;
      await support.joinAs(page, config.appUrl, name, role);
      const user = (await support.query(client, 'users', 'id,display_name', 'display_name', name))[0];
      assert(user?.id, `Missing ${role} identity`);
      report.users.push({ ...user, role });
      save();
      await resetIdentity(page);
    }
    const [tutor, student] = report.users;
    await support.joinAs(page, config.appUrl, student.display_name, 'student');
    for (const count of [10, 100, 1000]) {
      const room = await support.insert(client, 'rooms', { title: `Performance ${runId} ${count}`,
        description: `[browser-e2e-created] performance ${runId}`, tutor_id: tutor.id,
        is_active: true, ai_assistant_enabled: false, transfer_learning_enabled: false });
      report.rooms.push(room);
      save();
      const messages = Array.from({ length: count }, (_, index) => ({ id: crypto.randomUUID(), room_id: room.id,
        user_id: tutor.id, user_role: 'tutor', content: `Performance ${runId} ${count} message ${index}`,
        created_at: new Date(Date.now() - (count - index) * 1000).toISOString(), response_mode: 'tutoring' }));
      const feedback = messages.map((message, index) => ({ id: crypto.randomUUID(), room_id: room.id,
        message_id: message.id, user_id: student.id, feedback_type: index % 2 ? 'dislike' : 'like', rating: index % 5 + 1 }));
      const result = { count, room_id: room.id, input: { messages, feedback }, checks: {} };
      report.histories.push(result);
      await insertRows(client, 'messages', messages);
      await insertRows(client, 'message_feedback', feedback);
      const joinStart = Date.now();
      await page.goto(`${config.appUrl}/#/room/${room.id}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.room-post').waitFor({ timeout: 90000 });
      await page.getByText(messages[count - 1].content, { exact: true }).waitFor({ timeout: 90000 });
      await support.waitForMatch(() => page.locator('.post-comment button[title^="You rated this"]').count(), value => value === count, 'all own ratings');
      const joinEnd = Date.now();
      await flush(joinEnd);
      result.join = summarize(report.requests, joinStart, joinEnd);
      result.join.feedback_message_ids = report.requests.filter(row => row.started_ms >= joinStart && row.pathname === '/rest/v1/message_feedback' && row.method === 'GET')
        .map(row => new URL(row.url).searchParams.get('message_id'));
      const comments = page.locator('.post-comment');
      for (let index = 0; index < count; index++) {
        const comment = comments.filter({ has: page.getByText(messages[index].content, { exact: true }) });
        const button = comment.getByTitle(`You rated this ${feedback[index].rating}/5 stars`, { exact: true });
        assert.equal(await button.count(), 1, `Own rating ${index}`);
        assert.match(await button.innerText(), new RegExp(`1\\s*\\(${feedback[index].rating}\\.0`));
      }
      result.checks.seeded_counts_averages_and_own_ratings = count;
      result.bindings = await waitForBindings(page, report.websocket_messages, room.id, joinStart);
      await settleFeedback(page, report.requests);
      const windowStart = Date.now();
      await page.waitForTimeout(config.windowMs);
      const windowEnd = Date.now();
      await flush(windowEnd);
      result.steady_state = summarize(report.requests, windowStart, windowEnd);
      result.steady_state.bounds = assertHealthy(result.steady_state, count);
      const insert = { ...messages[0], id: crypto.randomUUID(), content: `Realtime INSERT ${runId} ${count}`, created_at: new Date().toISOString() };
      result.realtime_insert = assertRealtime(report.websocket_messages, insert.id, 'INSERT',
        await visibility(page, insert.content, () => insertRows(client, 'messages', [insert])));
      const update = `Realtime UPDATE ${runId} ${count}`;
      result.realtime_update = assertRealtime(report.websocket_messages, insert.id, 'UPDATE', await visibility(page, update, async () => {
        const { error } = await client.from('messages').update({ content: update }).eq('id', insert.id);
        if (error) throw error;
      }));
      const roomTitle = `Performance updated ${runId} ${count}`;
      result.room_update = assertRealtime(report.websocket_messages, room.id, 'UPDATE',
        await visibility(page, roomTitle, async () => {
          const { error } = await client.from('rooms').update({ title: roomTitle }).eq('id', room.id);
          if (error) throw error;
        }), 'rooms');
      assert.equal(result.room_update.websocket_event.record.title, roomTitle);
      const feedbackTarget = comments.filter({ has: page.getByText(messages[1].content, { exact: true }) });
      const feedbackStarted = Date.now();
      const { error: feedbackError } = await client.from('message_feedback').update({ rating: 4 }).eq('id', feedback[1].id);
      if (feedbackError) throw feedbackError;
      const feedbackPersisted = Date.now();
      await feedbackTarget.getByTitle('You rated this 4/5 stars', { exact: true }).waitFor({ timeout: 5000 });
      result.feedback_update = assertRealtime(report.websocket_messages, feedback[1].id, 'UPDATE', {
        mutation_started_ms: feedbackStarted, mutation_completed_ms: feedbackPersisted,
        visible_ms: Date.now(), end_to_end_ms: Date.now() - feedbackStarted, after_write_ms: Date.now() - feedbackPersisted,
      }, 'message_feedback');
      assert.equal(result.feedback_update.websocket_event.record.rating, 4);
      assert.equal(result.feedback_update.websocket_event.record.message_id, messages[1].id);
      assert.equal(result.feedback_update.websocket_event.record.feedback_type, 'dislike');
      assert.match(await feedbackTarget.getByTitle('You rated this 4/5 stars', { exact: true }).innerText(), /1\s*\(4\.0/);
      result.disconnected_sockets = await page.evaluate(() => window.__perfDisconnectRealtime());
      assert(result.disconnected_sockets > 0, 'No realtime socket was disconnected');
      const missed = { ...insert, id: crypto.randomUUID(), content: `Missed INSERT ${runId} ${count}` };
      const oldUpdate = `Missed old UPDATE ${runId} ${count}`;
      const recoveryStart = Date.now();
      await insertRows(client, 'messages', [missed]);
      const { error } = await client.from('messages').update({ content: oldUpdate }).eq('id', messages[0].id);
      if (error) throw error;
      await page.evaluate(() => { window.__perfRealtimeBlocked = false; });
      await page.getByText(missed.content, { exact: true }).waitFor({ timeout: 90000 });
      await page.getByText(oldUpdate, { exact: true }).waitFor({ timeout: 90000 });
      result.recovery = { disconnected_ms: recoveryStart, visible_ms: Date.now(), elapsed_ms: Date.now() - recoveryStart,
        inserted_message: missed, updated_message_id: messages[0].id, updated_content: oldUpdate };
      save();
      result.recovery.reconnected_bindings = await waitForBindings(page, report.websocket_messages, room.id, recoveryStart);
      save();
      const target = comments.filter({ has: page.getByText(oldUpdate, { exact: true }) });
      await settleFeedback(page, report.requests);
      const ratingStart = Date.now();
      await target.getByTitle('You rated this 1/5 stars', { exact: true }).click();
      await target.getByTitle('Rate 5 stars', { exact: true }).click();
      await target.getByRole('button', { name: 'Submit Rating', exact: true }).click();
      await target.getByTitle('You rated this 5/5 stars', { exact: true }).waitFor({ timeout: 30000 });
      await settleFeedback(page, report.requests);
      const ratingEnd = Date.now();
      await flush(ratingEnd);
      const refreshes = report.requests.filter(row => row.started_ms >= ratingStart && row.started_ms < ratingEnd && row.method === 'GET' && row.pathname === '/rest/v1/message_feedback');
      assertTargetedRefreshes(refreshes, messages[0].id);
      const ratingHttp = summarize(report.requests, ratingStart, ratingEnd);
      const saved = (await support.query(client, 'message_feedback', '*', 'message_id', messages[0].id))[0];
      assert.equal(saved.rating, 5);
      assert.equal(saved.feedback_type, 'like');
      result.rating = { message_id: messages[0].id, refresh_requests: refreshes.length, maximum_refresh_requests: 3, settled_ms: ratingEnd, http: ratingHttp, stored: saved,
        visible: await target.innerText(), elapsed_ms: Date.now() - ratingStart };
      await support.screenshot(page, evidenceDir, `history-${count}`);
      result.bindings = { ...result.bindings, ...assertBindings(report.websocket_messages, room.id, joinStart, Date.now()) };
      support.assertProjectTraffic(traffic);
      save();
      await page.goto('about:blank');
    }
    assert.deepEqual(report.errors, []);
    report.status = 'pass';
  } catch (error) {
    report.status = 'fail';
    report.errors.push(error.stack || String(error));
  } finally {
    if (browser) {
      try { await browser.close(); if (flush) await flush(); }
      catch (error) { report.errors.push(`Browser close: ${error.stack || error}`); report.status = 'fail'; }
    }
    for (const room of report.rooms) {
      try {
        await support.cleanupCreatedRoom(config, room.id, room.tutor_id);
        const remaining = {};
        for (const table of ['rooms', 'messages', 'message_feedback', 'sessions', 'session_checklists']) {
          const rows = await support.query(client, table, 'id', table === 'rooms' ? 'id' : 'room_id', room.id);
          remaining[table] = rows.length;
          assert.equal(rows.length, 0, `Cleanup left ${table}`);
        }
        report.cleanup.push({ room_id: room.id, status: 'pass', remaining });
      } catch (error) { report.cleanup.push({ room_id: room.id, status: 'fail', error: error.stack || String(error) }); report.status = 'fail'; }
    }
    if (report.cleanup.every(row => row.status === 'pass')) {
      for (const user of report.users) {
        try {
          const { error } = await client.from('users').delete().eq('id', user.id).eq('display_name', user.display_name);
          if (error) throw error;
          assert.equal((await support.query(client, 'users', 'id', 'id', user.id)).length, 0);
          user.cleanup = 'pass';
        } catch (error) {
          user.cleanup = 'fail';
          user.cleanup_error = errorDetails(error);
          report.errors.push(`User cleanup ${user.id}: ${JSON.stringify(user.cleanup_error)}`);
          report.status = 'fail';
        }
      }
    }
    try { if (fixtureLock) fixtureLock.release(); }
    catch (error) { report.errors.push(`Fixture lock release: ${error}`); report.status = 'fail'; }
    if (lease) {
      const safe = report.cleanup.every(row => row.status === 'pass') && report.users.every(user => user.cleanup === 'pass') && !report.errors.some(error => /^(Browser close:|Fixture lock release:)/.test(error));
      if (safe) {
        try { lease.release(); report.coordination.released = !lease.borrowed; }
        catch (error) { report.errors.push(String(error)); report.status = 'fail'; }
      } else report.coordination.retained = true;
    }
    report.completed_at = new Date().toISOString();
    save();
  }
  console.log(JSON.stringify({ status: report.status, evidence: evidenceDir,
    histories: report.histories.map(row => ({ count: row.count, steady_state: row.steady_state, recovery: row.recovery?.elapsed_ms })) }));
  if (report.status !== 'pass') process.exitCode = 1;
}

module.exports = { settings, summarize, assertHealthy, realtimeFrame, messageFrame, frameMetadata, assertPublicPayload, assertBindings, waitForBindings, assertRealtime, assertTargetedRefreshes, monitor, resetIdentity, errorDetails, createFixtureClient, allowMembershipRequest, routeEdgeRequest, main };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
