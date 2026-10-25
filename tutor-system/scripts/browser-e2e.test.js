#!/usr/bin/env node
// File: scripts/browser-e2e.js and browser-e2e/browser-e2e-support.js. Purpose: verify project selection, workflow cleanup, and learner message submission.
// Also covers assessment-browser-checks.js binding/gates and assessment-delivery.js policy preflight.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { configFromEnv, guardProject, assertProjectTraffic, extractedTargets, existingRoom, sendStudentMessage, PROJECT_URL, ROOMS, selectWorkflows, runWorkflows, shouldRetainLease } = require('./browser-e2e');
const { deliverFixedAssessment } = require('./browser-e2e/workflows/assessment-fixture');
const { templateChecklistItems } = require('./browser-e2e/workflows/transfer-status-events');
const { assertAssessmentGate, assertBoundAnswers } = require('./browser-e2e/workflows/assessment-browser-checks');
const assessmentDelivery = require('./browser-e2e/workflows/assessment-delivery');

const env = (target = 'staging') => ({
  E2E_APP_URL: 'http://localhost:3001',
  E2E_TARGET: target,
  E2E_SUPABASE_URL: target === 'production' ? 'https://zgbufaxooqxeabewktzd.supabase.co' : PROJECT_URL,
  E2E_SUPABASE_ANON_KEY: `${target}-anon-key`,
  SUPABASE_SERVICE_ROLE_KEY: `${target}-service-key`,
  SUPABASE_ACCESS_TOKEN: 'management-token'
});

test('accepts either named target and local app origin', () => {
  const config = configFromEnv(env());
  assert.equal(config.projectUrl, PROJECT_URL);
  assert.equal(config.appUrl, 'http://localhost:3001');
  const production = configFromEnv(env('production'));
  assert.equal(production.projectRef, 'zgbufaxooqxeabewktzd');
  assert.equal(production.projectUrl, 'https://zgbufaxooqxeabewktzd.supabase.co');
});

test('rejects production or another Supabase project', () => {
  for (const url of ['https://zgbufaxooqxeabewktzd.supabase.co', 'https://other.supabase.co']) {
    assert.throws(() => configFromEnv({ ...env(), E2E_SUPABASE_URL: url }), /does not match/);
  }
});

test('requires browser and fixture credentials without local provider secrets', () => {
  for (const key of ['E2E_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ACCESS_TOKEN']) {
    assert.throws(() => configFromEnv({ ...env(), [key]: '' }), /Set E2E_APP_URL/);
  }
});

test('rejects an anon key used as the privileged fixture writer', () => {
  assert.throws(() => configFromEnv({ ...env(), SUPABASE_SERVICE_ROLE_KEY: 'staging-anon-key' }), /must differ/);
});

test('rejects an app URL with credentials or a hash route', () => {
  for (const url of ['http://user:pass@localhost:3001', 'http://localhost:3001/#/room/old', 'http://localhost:3001/old']) {
    assert.throws(() => configFromEnv({ ...env(), E2E_APP_URL: url }), /origin without credentials or a hash/);
  }
});

test('fails if app traffic goes to another project or never reaches the target', () => {
  assert.throws(() => assertProjectTraffic({ seen: new Set([PROJECT_URL]), rejected: ['https://zgbufaxooqxeabewktzd.supabase.co'] }), /another Supabase/);
  assert.throws(() => assertProjectTraffic({ seen: new Set(), rejected: [] }), /no ciubrzggdqesgvfkpolj/);
  assert.doesNotThrow(() => assertProjectTraffic({ seen: new Set([PROJECT_URL]), rejected: [] }));
});

test('blocks production requests before browser navigation can write there', async () => {
  let handler;
  const traffic = await guardProject({ route: async (_pattern, callback) => { handler = callback; } });
  let aborted = false;
  await handler({
    request: () => ({ url: () => 'https://zgbufaxooqxeabewktzd.supabase.co/rest/v1/rooms' }),
    abort: async () => { aborted = true; },
    continue: async () => { throw new Error('Production request was continued'); }
  });
  assert.equal(aborted, true);
  assert.deepEqual(traffic.rejected, ['https://zgbufaxooqxeabewktzd.supabase.co']);
});

test('requires usable provider extraction rather than a fallback', () => {
  const request = { messages: [{ content: 'Extract the cybersecurity learning targets' }] };
  const response = (content) => ({ status: 200, request, response: { ok: true, data: { content } } });
  assert.deepEqual(extractedTargets([response('not JSON')]), []);
  assert.deepEqual(extractedTargets([response('{"detection_areas":[]}')]), []);
  assert.deepEqual(extractedTargets([response('{"detection_areas":[null]}')]), []);
  assert.deepEqual(extractedTargets([response('{"detection_areas":["Repeated","Repeated"]}')]), ['Repeated']);
  assert.equal(extractedTargets([response('{"detection_areas":["Urgent wording","Open the official app"]}')]).length, 2);
});

test('transfer status checklist preserves every persisted room target', () => {
  const config = {
    detection_areas: ['Urgent warning', 'Suspicious URL'],
    verification_steps: ['Do not click', 'Open the official app']
  };
  assert.deepEqual(templateChecklistItems(config), [
    { area_text: 'Urgent warning', item_type: 'detection_area', priority: 'important' },
    { area_text: 'Suspicious URL', item_type: 'detection_area', priority: 'important' },
    { area_text: 'Do not click', item_type: 'detection_area', priority: 'important' },
    { area_text: 'Open the official app', item_type: 'detection_area', priority: 'important' }
  ]);
  assert.equal(templateChecklistItems({ detection_areas: ['Only one'], verification_steps: [] }).length, 1);
  assert.throws(() => templateChecklistItems({ detection_areas: [], verification_steps: [] }), /no learning targets/);
});

test('existing room selection validates template and owner without inserting', async () => {
  const expected = ROOMS['checklist-generation'];
  const client = {
    from: (table) => ({
      select: () => ({ eq: async () => ({ data: table === 'rooms' ? [{
        id: expected.id, title: expected.title, description: '[browser-e2e-template]', tutor_id: 'tutor-id', is_active: true,
        transfer_learning_enabled: false,
        guard_mode: false, guard_mode_changed_at: null, guard_mode_change_source: null,
        ai_assistant_enabled: true, ai_assistant_prompt: 'Template prompt', pre_populated_dialogue: [{}]
      }] : [], error: null }) }),
      insert: () => { throw new Error('Room selection must not insert'); }
    })
  };
  assert.equal((await existingRoom(client, 'checklist-generation', 'tutor-id')).id, expected.id);
  await assert.rejects(existingRoom(client, 'checklist-generation', 'wrong-owner'), /no longer matches/);
});

test('used template room is rejected before the workflow can write', async () => {
  const expected = ROOMS['checklist-management'];
  const client = {
    from: (table) => ({
      select: () => ({ eq: async () => ({ data: table === 'rooms' ? [{
        id: expected.id, title: expected.title, description: '[browser-e2e-template]', tutor_id: 'tutor-id', is_active: true,
        transfer_learning_enabled: false,
        guard_mode: false, guard_mode_changed_at: null, guard_mode_change_source: null,
        ai_assistant_enabled: true, ai_assistant_prompt: 'Template prompt', pre_populated_dialogue: [{}]
      }] : table === 'session_checklists' ? [{ id: 'used-checklist', is_active: true }] : [], error: null }) })
    })
  };
  await assert.rejects(existingRoom(client, 'checklist-management', 'tutor-id'), /still has session_checklists/);
});

test('selects the transfer status workflow alongside the existing browser workflows', () => {
  assert.deepEqual(selectWorkflows([]), [
    'cyberbullying',
    'tutor-response', 'checklist-generation', 'room-assessment-setup', 'checklist-management', 'checklist-coverage', 'guard-mode',
    'assessment-delivery', 'assessment-answer', 'transfer-status-events', 'early-message-recheck'
  ]);
  assert.deepEqual(selectWorkflows(['--workflow=checklist-generation']), ['checklist-generation']);
  assert.deepEqual(selectWorkflows(['--workflow=room-assessment-setup']), ['room-assessment-setup']);
  assert.deepEqual(selectWorkflows(['--workflow=assessment-answer']), ['assessment-answer']);
  assert.deepEqual(selectWorkflows(['--workflow=transfer-status-events']), ['transfer-status-events']);
  assert.deepEqual(selectWorkflows(['--workflow=early-message-recheck']), ['early-message-recheck']);
  assert.throws(() => selectWorkflows(['--workflow=unknown']), /Unknown workflow/);
  assert.throws(() => selectWorkflows(['--workflow=tutor-response', '--workflow=assessment-answer']), /Use --workflow/);
});

test('a failed workflow does not stop another independent workflow', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-e2e-runner-'));
  try {
    const called = [];
    const context = {
      tutorPage: { screenshot: async () => {} },
      studentPage: { screenshot: async () => {} }
    };
    const report = { room_ids: [], results: {} };
    const passed = await runWorkflows(['first', 'second'], context, report, dir, {
      first: async () => { called.push('first'); throw new Error('first failed'); },
      second: async () => { called.push('second'); return { room_id: 'second-room' }; }
    });
    assert.equal(passed, false);
    assert.deepEqual(called, ['first', 'second']);
    assert.equal(report.results.first.status, 'fail');
    assert.equal(report.results.second.status, 'pass');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')).results.second.evidence.room_id, 'second-room');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('cleanup runs after a workflow failure and its failure fails the workflow', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-e2e-cleanup-'));
  try {
    const cleaned = [];
    const context = {
      tutorPage: { screenshot: async () => {} },
      studentPage: { screenshot: async () => {} },
      detachRooms: async () => { cleaned.push('detached'); },
      cleanupRoom: async (id) => { cleaned.push(id); throw new Error('cleanup failed'); }
    };
    const report = { room_ids: [], results: {} };
    const passed = await runWorkflows(['broken'], context, report, dir, {
      broken: async () => { report.room_ids.push('room-id'); throw new Error('workflow failed'); }
    });
    assert.equal(passed, false);
    assert.deepEqual(cleaned, ['detached', 'room-id']);
    assert.equal(report.results.broken.status, 'fail');
    assert.match(report.results.broken.cleanup[0].error, /cleanup failed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('learner sends once with prior, prompted, consecutive, or no required ratings', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const { initiallyOpen, requiredRatings } of [
      { initiallyOpen: true, requiredRatings: 1 },
      { initiallyOpen: false, requiredRatings: 1 },
      { initiallyOpen: false, requiredRatings: 0 },
      { initiallyOpen: false, requiredRatings: 2 },
      { initiallyOpen: true, requiredRatings: 2 }
    ]) {
      const page = await browser.newPage();
      await page.setContent(`
        <style>.rating-reminder-backdrop { position: fixed; inset: 0; background: white; z-index: 1; }</style>
        <form class="comment-input-form">
          <textarea class="comment-input-field"></textarea><button type="submit">Send</button>
        </form>
        <template id="reminder-template">
          <div class="rating-reminder-backdrop" data-testid="rating-reminder-backdrop">
            <section role="alertdialog" aria-label="Required rating">
              <div class="rating-reminder-choice"><button type="button">Helpful</button></div>
              <div class="rating-reminder-stars">
                <button type="button">1</button><button type="button">2</button>
                <button type="button">3</button><button type="button">4</button>
              </div>
              <button type="button" class="rating-reminder-submit">Submit rating</button>
            </section>
          </div>
        </template>
        <script>
          window.sent = [];
          window.submitAttempts = 0;
          window.ratingsRemaining = ${requiredRatings};
          window.rated = window.ratingsRemaining === 0;
          window.showRating = () => {
            if (document.querySelector('[data-testid="rating-reminder-backdrop"]')) return;
            const reminder = document.querySelector('#reminder-template').content.firstElementChild.cloneNode(true);
            let useful = false;
            let stars = 0;
            reminder.querySelector('.rating-reminder-choice button').onclick = () => { useful = true; };
            reminder.querySelectorAll('.rating-reminder-stars button').forEach((button, index) => {
              button.onclick = () => { stars = index + 1; };
            });
            reminder.querySelector('.rating-reminder-submit').onclick = () => {
              if (useful && stars === 4) {
                window.ratingsRemaining -= 1;
                window.rated = window.ratingsRemaining === 0;
                reminder.remove();
              }
            };
            document.body.append(reminder);
          };
          document.querySelector('form').onsubmit = (event) => {
            event.preventDefault();
            window.submitAttempts += 1;
            if (!window.rated) { window.showRating(); return; }
            const input = document.querySelector('textarea');
            window.sent.push(input.value);
            input.value = '';
          };
        </script>
      `);
      if (initiallyOpen) await page.evaluate(() => window.showRating());
      await sendStudentMessage(page, 'Check the official app.');
      const result = await page.evaluate(() => ({ sent: window.sent, rated: window.rated, attempts: window.submitAttempts }));
      assert.deepEqual(result.sent, ['Check the official app.']);
      assert.equal(result.rated, true);
      assert.equal(result.attempts, requiredRatings + (initiallyOpen ? 0 : 1));
      await page.close();
    }
  } finally { await browser.close(); }
});

test('independent learner fixture keeps public question ID separate from assessment ID', async () => {
  let rpcName;
  let payload;
  const ctx = {
    client: {
      rpc: async (name, input) => {
        rpcName = name;
        payload = input;
        return { data: { message: { id: 'question-message', assessment: { id: 'private-assessment' } } }, error: null };
      }
    },
    student: { id: 'student-id' }, tutor: { id: 'tutor-id' }
  };
  const fixture = {
    room: { id: 'room-id' }, checklist: { id: 'checklist-id' },
    focus: { id: 'focus-id' }, items: [{ id: 'item-id' }]
  };
  const delivered = await deliverFixedAssessment(ctx, fixture);
  assert.equal(rpcName, 'send_reviewed_tutor_response_v4');
  assert.equal(payload.p_student_id, 'student-id');
  assert.equal(payload.p_reviewed_payload.decision.target_item_id, 'item-id');
  assert.deepEqual(payload.p_reviewed_payload.assessment.correct_option_ids, ['B']);
  assert.equal(delivered.question_message_id, 'question-message');
  assert.equal(delivered.assessment_id, 'private-assessment');
});

test('assessment binding rejects missing IDs, duplicate rows, wrong selections and unbound learner text', () => {
  const answer = { id: 'answer', user_id: 'student', assessment_id: 'assessment', parent_message_id: 'question',
    assessment_selected_option_ids: ['B'] };
  const verify = rows => assertBoundAnswers(rows, 'student', 'assessment', 'question', [['B']], []);
  assert.deepEqual(verify([answer]), [answer]);
  for (const broken of [
    { ...answer, assessment_id: null },
    { ...answer, parent_message_id: null },
    { ...answer, assessment_selected_option_ids: null },
    { ...answer, assessment_selected_option_ids: ['A'] }
  ]) assert.throws(() => verify([broken]));
  assert.throws(() => verify([answer, { ...answer, id: 'duplicate' }]), /duplicate/);
  assert.throws(() => verify([answer, { id: 'free-text', user_id: 'student', content: 'A' }]), /unbound/);
  assert.deepEqual(verify([answer, { id: 'foreign', user_id: 'another-student', content: 'A' }]), [answer]);
  const multi = { ...answer, assessment_selected_option_ids: ['D', 'A'] };
  assert.deepEqual(assertBoundAnswers([multi], 'student', 'assessment', 'question', [['A', 'D']], []), [multi]);
});

test('assessment gate checks every generic Reply and restores terminal composer access', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const disabled of [true, false]) {
      await page.setContent(`<textarea class="comment-input-field" ${disabled ? 'disabled' : ''}></textarea>
        <button ${disabled ? 'disabled' : ''}>Reply</button><button ${disabled ? 'disabled' : ''}>Reply</button>`);
      const gate = await assertAssessmentGate(page, disabled);
      assert.equal(gate.reply_count, 2);
      assert.equal(gate.composer_disabled, disabled);
      await assert.rejects(assertAssessmentGate(page, !disabled), /composer/);
    }
    await page.setContent('<textarea class="comment-input-field" disabled></textarea><button disabled>Reply</button><button>Reply</button>');
    await assert.rejects(assertAssessmentGate(page, true), /Generic Reply/);
    await page.setContent('<textarea class="comment-input-field" disabled></textarea>');
    await assert.rejects(assertAssessmentGate(page, true), /No generic Reply/);
  } finally { await browser.close(); }
});

test('two-target assessment delivery rejects old hosted scheduling before creating fixtures', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-e2e-policy-'));
  const originalFetch = global.fetch;
  let fixtureTouched = false;
  try {
    global.fetch = async () => ({ ok: true, json: async () => [{ final_policy_helper: false, preparation_uses_final_policy: false }] });
    await assert.rejects(assessmentDelivery({
      evidenceDir: dir, config: { projectRef: 'test-project', accessToken: 'test-token' },
      existingRoom: async () => { fixtureTouched = true; throw new Error('Fixture must remain untouched'); }
    }), /Live prerequisite mismatch/);
    assert.equal(fixtureTouched, false);
    const evidence = JSON.parse(fs.readFileSync(path.join(dir, 'assessment-delivery-policy-prerequisite.json'), 'utf8'));
    assert.equal(evidence.project_ref, 'test-project');
    assert.equal(evidence.live_policy[0].final_policy_helper, false);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('assessment delivery requires feedback on the terminal answer after closure before the next target', () => {
  const assessment = { terminal_answer_message_id: 'terminal-answer', closed_at: '2026-10-14T15:00:00.000Z' };
  const feedback = { parent_message_id: 'terminal-answer', response_mode: 'tutoring', created_at: '2026-10-14T15:00:01.000Z' };
  assert.doesNotThrow(() => assessmentDelivery.assertTutorFeedback(feedback, assessment));
  assert.throws(() => assessmentDelivery.assertTutorFeedback({ ...feedback, parent_message_id: 'support-observation' }, assessment),
    /terminal learner answer/);
  assert.throws(() => assessmentDelivery.assertTutorFeedback({ ...feedback, response_mode: 'guard' }, assessment),
    /wrong response mode/);
  for (const created_at of ['2026-10-14T14:59:59.000Z', assessment.closed_at]) {
    assert.throws(() => assessmentDelivery.assertTutorFeedback({ ...feedback, created_at }, assessment),
      /after the assessment closes/);
  }
});


test('a workflow-owned fixture cleanup failure retains the project lease after room cleanup succeeds', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-e2e-outsider-cleanup-'));
  try {
    const report = { room_ids: [], results: {} };
    const context = {
      tutorPage: { screenshot: async () => {} }, studentPage: { screenshot: async () => {} },
      detachRooms: async () => {}, cleanupRoom: async () => {}
    };
    const passed = await runWorkflows(['security'], context, report, dir, {
      security: async () => {
        report.room_ids.push('test-room');
        const error = new Error('Security outsider cleanup failed');
        error.cleanupFailed = true;
        throw error;
      }
    });
    assert.equal(passed, false);
    assert.equal(report.results.security.cleanup[0].status, 'pass');
    assert.equal(report.results.security.fixture_cleanup_failed, true);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
    assert.equal(shouldRetainLease(saved), true);
    // A failed assertion after successful cleanup remains safe to release, as before.
    saved.results.security.fixture_cleanup_failed = false;
    assert.equal(shouldRetainLease(saved), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('privacy collector inspects actual local HTTP and WebSocket bytes without retaining private values', async () => {
  // Instrumentation acceptance only; this local server is not application/staging security evidence.
  const http = require('node:http');
  const { WebSocketServer } = require('ws');
  const { captureLearnerData } = require('./browser-e2e/workflows/assessment-privacy-checks');
  const server = http.createServer((request, response) => {
    if (request.url === '/') { response.end('<!doctype html><title>Privacy capture fixture</title>'); return; }
    response.setHeader('Content-Type', 'application/json');
    response.statusCode = request.url.startsWith('/functions/') ? 403 : 200;
    response.end(JSON.stringify(response.statusCode === 403 ? { error: { code: 'FORBIDDEN' } } : { renamed: 'local-private-canary' }));
  });
  const sockets = new WebSocketServer({ server, path: '/realtime/v1/websocket' });
  sockets.on('connection', socket => socket.send(JSON.stringify([null, null, 'topic', 'postgres_changes', {
    data: { table: 'messages', type: 'INSERT', record: { id: 'local-row', renamed: 'local-private-canary' } }
  }])));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser; let capture;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage(); capture = captureLearnerData(page, origin);
    await page.goto(origin);
    await page.evaluate(async () => {
      await fetch('/rest/v1/messages').then(response => response.json());
      await fetch('/functions/v1/assessment-api', { method: 'POST', body: JSON.stringify({ renamed: 'local-private-canary' }) }).then(response => response.json());
      await new Promise((resolve, reject) => {
        const socket = new WebSocket(location.origin.replace(/^http/, 'ws') + '/realtime/v1/websocket');
        socket.onmessage = () => resolve(); socket.onerror = reject;
      });
    });
    assert.equal(capture.hasRealtimeRow('local-row'), true);
    const records = await capture.checkpoint({ privateValues: [{ label: 'fixture', value: 'local-private-canary' }] });
    for (const surface of ['network_request', 'network', 'realtime']) {
      assert(records.some(row => row.surface === surface && row.violations.some(finding => finding.kind === 'private_value')));
    }
    assert(records.some(row => row.surface === 'error' && row.status === 403));
    assert(!JSON.stringify(records).includes('local-private-canary'));
  } finally {
    capture?.stop(); await browser?.close();
    for (const socket of sockets.clients) socket.terminate();
    await new Promise(resolve => sockets.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
});
