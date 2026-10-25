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
  assert(Number.isInteger(windowMs) && windowMs >= 1000, 'PERF_WINDOW_MS must be an integer >= 1000');
  return { ...config, windowMs };
}

function summarize(records, started, ended) {
  const rows = records.filter(row => row.started_ms >= started && row.started_ms < ended);
  const messages = rows.filter(row => row.pathname === '/rest/v1/messages' && row.method === 'GET');
  const feedback = rows.filter(row => row.pathname === '/rest/v1/message_feedback' && row.method === 'GET');
  const metric = requests => ({ requests: requests.length,
    requests_per_minute: requests.length * 60000 / (ended - started),
    response_body_bytes: requests.reduce((sum, row) => sum + (row.response_body_bytes || 0), 0) });
  return { duration_ms: ended - started, messages: metric(messages), feedback: metric(feedback), all: metric(rows) };
}

function monitor(page, records) {
  const requests = new Map();
  const pending = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.hostname.endsWith('.supabase.co')) return;
    const row = { started_ms: Date.now(), url: request.url(), pathname: url.pathname,
      method: request.method(), request_body: request.postData() };
    requests.set(request, row);
    records.push(row);
  });
  page.on('response', response => {
    const row = requests.get(response.request());
    if (!row) return;
    pending.push((async () => {
      row.status = response.status();
      try {
        const body = await response.body();
        row.response_body_bytes = body.length;
        row.response_body = body.toString('utf8');
      } catch (error) { row.capture_error = String(error); }
    })());
  });
  page.on('requestfailed', request => {
    const row = requests.get(request);
    if (row) row.failure = request.failure();
  });
  return async () => { await Promise.all(pending); };
}

async function insertRows(client, table, rows) {
  for (let offset = 0; offset < rows.length; offset += 100) {
    const { error } = await client.from(table).insert(rows.slice(offset, offset + 100));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function visibility(page, text, mutate) {
  const started = Date.now();
  await mutate();
  const persisted = Date.now();
  await page.getByText(text, { exact: true }).waitFor({ timeout: 90000 });
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
    users: [], rooms: [], histories: [], cleanup: [], requests: [], errors: [] };
  const save = () => support.writeJson(path.join(evidenceDir, 'report.json'), report);
  const client = createClient(config.projectUrl, config.serviceKey, { auth: { persistSession: false } });
  let browser, fixtureLock, lease, flush;
  try {
    fixtureLock = acquireFixtureLock(config.projectRef, { runId });
    lease = acquireProjectLock(config.projectRef, { operation: 'room-performance', commit, runId, evidenceDir });
    report.coordination = { ref: lease.ref, tag_sha: lease.tag_sha, borrowed: lease.borrowed, owner: lease.owner };
    save();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const traffic = await support.guardProject(context);
    await context.route('**/functions/v1/**', route => {
      report.errors.push(`Unexpected provider/Edge request: ${new URL(route.request().url()).pathname}`);
      return route.abort('blockedbyclient');
    });
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
    flush = monitor(page, report.requests);
    for (const role of ['tutor', 'student']) {
      const name = `Performance ${role} ${runId}`;
      await support.joinAs(page, config.appUrl, name, role);
      const user = (await support.query(client, 'users', 'id,display_name', 'display_name', name))[0];
      assert(user?.id, `Missing ${role} identity`);
      report.users.push({ ...user, role });
      await page.evaluate(() => localStorage.clear());
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
      await flush();
      result.join = summarize(report.requests, joinStart, Date.now());
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
      const windowStart = Date.now();
      await page.waitForTimeout(config.windowMs);
      await flush();
      result.steady_state = summarize(report.requests, windowStart, Date.now());
      const insert = { ...messages[0], id: crypto.randomUUID(), content: `Realtime INSERT ${runId} ${count}`, created_at: new Date().toISOString() };
      result.realtime_insert = await visibility(page, insert.content, () => insertRows(client, 'messages', [insert]));
      const update = `Realtime UPDATE ${runId} ${count}`;
      result.realtime_update = await visibility(page, update, async () => {
        const { error } = await client.from('messages').update({ content: update }).eq('id', insert.id);
        if (error) throw error;
      });
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
      const target = comments.filter({ has: page.getByText(oldUpdate, { exact: true }) });
      const ratingStart = Date.now();
      await target.getByTitle('You rated this 1/5 stars', { exact: true }).click();
      await target.getByTitle('Rate 5 stars', { exact: true }).click();
      await target.getByRole('button', { name: 'Submit Rating', exact: true }).click();
      await target.getByTitle('You rated this 5/5 stars', { exact: true }).waitFor({ timeout: 30000 });
      await flush();
      const refreshes = report.requests.filter(row => row.started_ms >= ratingStart && row.method === 'GET' && row.pathname === '/rest/v1/message_feedback');
      assert.equal(refreshes.length, 1, 'Rating should request one targeted feedback refresh');
      const refreshUrl = new URL(refreshes[0].url);
      assert.equal(refreshUrl.searchParams.get('message_id'), `in.(${messages[0].id})`, 'Refresh must contain only the rated message');
      const saved = (await support.query(client, 'message_feedback', '*', 'message_id', messages[0].id))[0];
      assert.equal(saved.rating, 5);
      assert.equal(saved.feedback_type, 'like');
      result.rating = { message_id: messages[0].id, refresh_requests: refreshes.length, stored: saved,
        visible: await target.innerText(), elapsed_ms: Date.now() - ratingStart };
      await support.screenshot(page, evidenceDir, `history-${count}`);
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
        } catch (error) { user.cleanup = 'fail'; report.errors.push(String(error)); report.status = 'fail'; }
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

module.exports = { settings, summarize, main };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
