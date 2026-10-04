#!/usr/bin/env node
// File: scripts/browser-e2e.js and browser-e2e/browser-e2e-support.js. Purpose: verify project selection, workflow cleanup, and learner message submission.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { configFromEnv, guardProject, assertProjectTraffic, extractedTargets, existingRoom, sendStudentMessage, PROJECT_URL, ROOMS, selectWorkflows, runWorkflows } = require('./browser-e2e');
const { deliverFixedAssessment } = require('./browser-e2e/workflows/assessment-fixture');
const { templateChecklistItems } = require('./browser-e2e/workflows/transfer-status-events');

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
  const request = { messages: [{ content: 'Extract cybersecurity learning content' }] };
  const response = (content) => ({ status: 200, request, response: { ok: true, data: { content } } });
  assert.deepEqual(extractedTargets([response('not JSON')]), []);
  assert.deepEqual(extractedTargets([response('{"understanding":["[understanding] None"],"behavior":["[behavior] None"]}')]), []);
  assert.equal(extractedTargets([response('{"understanding":["[understanding] Urgent wording"],"behavior":["[behavior] Open the official app"]}')]).length, 2);
});

test('transfer status checklist preserves every persisted room target', () => {
  const config = {
    detection_areas: ['Urgent warning', 'Suspicious URL'],
    verification_steps: ['Do not click', 'Open the official app']
  };
  assert.deepEqual(templateChecklistItems(config), [
    { area_text: 'Urgent warning', item_type: 'detection_area', priority: 'important' },
    { area_text: 'Suspicious URL', item_type: 'detection_area', priority: 'important' },
    { area_text: 'Do not click', item_type: 'verification_step', priority: 'critical' },
    { area_text: 'Open the official app', item_type: 'verification_step', priority: 'critical' }
  ]);
  assert.throws(() => templateChecklistItems({ detection_areas: [], verification_steps: ['Only one'] }),
    /detection areas/);
});

test('existing room selection validates template and owner without inserting', async () => {
  const expected = ROOMS['checklist-generation'];
  const client = {
    from: (table) => ({
      select: () => ({ eq: async () => ({ data: table === 'rooms' ? [{
        id: expected.id, title: expected.title, description: '[browser-e2e-template]', tutor_id: 'tutor-id', is_active: true,
        transfer_learning_enabled: false,
        active_response_mode: 'tutoring', mode_changed_at: null, mode_change_source: null,
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
        active_response_mode: 'tutoring', mode_changed_at: null, mode_change_source: null,
        ai_assistant_enabled: true, ai_assistant_prompt: 'Template prompt', pre_populated_dialogue: [{}]
      }] : table === 'session_checklists' ? [{ id: 'used-checklist', is_active: true }] : [], error: null }) })
    })
  };
  await assert.rejects(existingRoom(client, 'checklist-management', 'tutor-id'), /still has session_checklists/);
});

test('selects the transfer status workflow alongside the existing browser workflows', () => {
  assert.deepEqual(selectWorkflows([]), [
    'tutor-response', 'checklist-generation', 'room-assessment-setup', 'checklist-management', 'checklist-coverage', 'guard-mode',
    'assessment-delivery', 'assessment-answer', 'transfer-status-events'
  ]);
  assert.deepEqual(selectWorkflows(['--workflow=checklist-generation']), ['checklist-generation']);
  assert.deepEqual(selectWorkflows(['--workflow=room-assessment-setup']), ['room-assessment-setup']);
  assert.deepEqual(selectWorkflows(['--workflow=assessment-answer']), ['assessment-answer']);
  assert.deepEqual(selectWorkflows(['--workflow=transfer-status-events']), ['transfer-status-events']);
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
      cleanupRoom: async (id) => { cleaned.push(id); throw new Error('cleanup failed'); }
    };
    const report = { room_ids: [], results: {} };
    const passed = await runWorkflows(['broken'], context, report, dir, {
      broken: async () => { report.room_ids.push('room-id'); throw new Error('workflow failed'); }
    });
    assert.equal(passed, false);
    assert.deepEqual(cleaned, ['room-id']);
    assert.equal(report.results.broken.status, 'fail');
    assert.match(report.results.broken.cleanup[0].error, /cleanup failed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('learner sends once with a prior, prompted, or no required rating', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const initiallyOpen of [true, false, null]) {
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
          window.rated = ${initiallyOpen === null};
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
              if (useful && stars === 4) { window.rated = true; reminder.remove(); }
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
      assert.equal(result.attempts, initiallyOpen === false ? 2 : 1);
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
