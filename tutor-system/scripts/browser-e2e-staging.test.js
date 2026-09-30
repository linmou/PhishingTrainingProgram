#!/usr/bin/env node
// File: scripts/browser-e2e-staging.js. Purpose: verify existing-room selection, staging preflight, and cleanup handling.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { configFromEnv, guardProject, assertProjectTraffic, extractedTargets, existingRoom, PROJECT_URL, ROOMS, selectWorkflows, runWorkflows } = require('./browser-e2e-staging');
const { deliverFixedAssessment } = require('./browser-e2e/workflows/assessment-fixture');

const env = () => ({
  E2E_APP_URL: 'http://localhost:3001',
  REACT_APP_SUPABASE_STAGING_URL: PROJECT_URL,
  REACT_APP_SUPABASE_STAGING_ANON_KEY: 'staging-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'staging-service-key',
  SUPABASE_ACCESS_TOKEN: 'management-token',
  REACT_APP_OAI_API_KEY: 'provider-key',
  REACT_APP_OAI_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
});

test('accepts an explicit staging target and local app origin', () => {
  const config = configFromEnv(env());
  assert.equal(config.projectUrl, PROJECT_URL);
  assert.equal(config.appUrl, 'http://localhost:3001');
});

test('rejects production or another Supabase project', () => {
  for (const url of ['https://zgbufaxooqxeabewktzd.supabase.co', 'https://other.supabase.co']) {
    assert.throws(() => configFromEnv({ ...env(), REACT_APP_SUPABASE_STAGING_URL: url }), /staging project/);
  }
});

test('requires credentials for database and provider evidence', () => {
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ACCESS_TOKEN', 'REACT_APP_OAI_API_KEY']) {
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

test('fails if app traffic goes to production or never reaches staging', () => {
  assert.throws(() => assertProjectTraffic({ seen: new Set([PROJECT_URL]), rejected: ['https://zgbufaxooqxeabewktzd.supabase.co'] }), /another Supabase/);
  assert.throws(() => assertProjectTraffic({ seen: new Set(), rejected: [] }), /no staging/);
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
  const response = (content) => ({ status: 200, request, response: { choices: [{ message: { content } }] } });
  assert.deepEqual(extractedTargets([response('not JSON')]), []);
  assert.deepEqual(extractedTargets([response('{"understanding":["[understanding] None"],"behavior":["[behavior] None"]}')]), []);
  assert.equal(extractedTargets([response('{"understanding":["[understanding] Urgent wording"],"behavior":["[behavior] Open the official app"]}')]).length, 2);
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

test('selects one named workflow or all seven staging workflows', () => {
  assert.deepEqual(selectWorkflows([]), [
    'tutor-response', 'checklist-generation', 'checklist-management', 'checklist-coverage', 'guard-mode',
    'assessment-delivery', 'assessment-answer'
  ]);
  assert.deepEqual(selectWorkflows(['--workflow=checklist-generation']), ['checklist-generation']);
  assert.deepEqual(selectWorkflows(['--workflow=assessment-answer']), ['assessment-answer']);
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
