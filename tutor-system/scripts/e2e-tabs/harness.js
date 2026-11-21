// Purpose: one fresh browser context per scenario. Its pages are tabs that share localStorage, so
// `storage` events between them are real browser events. Supabase traffic goes to the fake backend;
// any other non-app request is aborted, so nothing reaches a real server.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createBackend, MOCK_ORIGIN } = require('./mock-backend');

const USER_KEY = 'tutor_system_user';

async function setup(browser, app, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const backend = createBackend();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(20000);
  const network = [];
  const consoleLog = [];
  const blocked = [];
  const checks = [];
  const t0 = Date.now();
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(MOCK_ORIGIN)) return backend.handle(route);
    if (url.startsWith(app) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  await context.routeWebSocket(url => url.href.startsWith(MOCK_ORIGIN.replace('https', 'wss')), ws => backend.realtime(ws));

  async function tab(name) {
    const page = await context.newPage();
    page.on('request', req => {
      if (!req.url().startsWith(MOCK_ORIGIN)) return;
      let body = null;
      try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = req.postData(); }
      network.push({
        t: Date.now() - t0, tab: name, method: req.method(), path: new URL(req.url()).pathname,
        appUser: req.headers()['x-application-user-id'] ?? null, operation: body && body.operation, body,
      });
    });
    page.on('console', msg => consoleLog.push({ t: Date.now() - t0, tab: name, type: msg.type(), text: msg.text().slice(0, 500) }));
    page.on('pageerror', err => consoleLog.push({ t: Date.now() - t0, tab: name, type: 'pageerror', text: String(err).slice(0, 500) }));
    return page;
  }

  let shot = 0;
  const snap = (page, label) => {
    shot += 1;
    return page.screenshot({ path: path.join(dir, `${String(shot).padStart(2, '0')}-${label}.png`), fullPage: true });
  };
  const check = (name, pass, detail) => {
    checks.push({ name, pass: Boolean(pass), detail });
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass || detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
  };
  const mark = () => network.length;
  const since = (from, filter = () => true) => network.slice(from).filter(filter);
  const assessment = (from, tabName) => since(from, r => r.path === '/functions/v1/assessment-api' && (!tabName || r.tab === tabName));

  async function finish() {
    // Holds in every scenario: the transport never sends an assessment-api call without a tab identity.
    const headerless = backend.assessmentCalls.filter(call => !call.header);
    check('No assessment-api request without x-application-user-id (any tab)', headerless.length === 0, headerless.map(c => c.operation));
    const write = (file, data) => fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2));
    write('network.json', network);
    write('console.json', consoleLog);
    write('backend.json', {
      assessmentCalls: backend.assessmentCalls, claims: backend.claims, visits: backend.visits, unknown: backend.unknown,
      sessions: backend.db.sessions, checklists: backend.db.session_checklists, blockedExternal: blocked,
    });
    write('checks.json', checks);
    await context.close().catch(() => {});
    return checks;
  }

  return { app, backend, context, tab, snap, check, mark, since, assessment, finish, consoleLog };
}

async function signIn(page, app, name, role) {
  await page.goto(`${app}/`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.locator(`input[type="radio"][value="${role}"]`).check();
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForFunction(key => Boolean(localStorage.getItem(key)), USER_KEY);
  await page.waitForTimeout(500);
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), USER_KEY);
}

function seedRoom(backend, tutorId, title) {
  const room = {
    id: crypto.randomUUID(), title, description: `${title} (e2e-tabs fake backend)`, tutor_id: tutorId,
    is_active: true, password: null, max_students: 1, ai_assistant_enabled: false, pre_populated_dialogue: null,
    created_at: new Date(Date.now() - 60000).toISOString(), updated_at: new Date().toISOString(),
  };
  backend.db.rooms.push(room);
  return room;
}

function userRow(name, role) {
  const at = new Date().toISOString();
  return { id: crypto.randomUUID(), display_name: name, current_role: role, status: 'active', created_at: at, updated_at: at };
}

function seatLearner(backend, room, learner) {
  backend.db.sessions.push({
    id: crypto.randomUUID(), room_id: room.id, tutor_id: room.tutor_id, student_id: learner.id,
    status: 'active', created_at: new Date().toISOString(),
  });
}

module.exports = { setup, signIn, seedRoom, userRow, seatLearner, USER_KEY };
