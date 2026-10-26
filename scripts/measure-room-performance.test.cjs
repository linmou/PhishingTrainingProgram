#!/usr/bin/env node
// Responsibility: verify staging-only preflight and measurement accounting in measure-room-performance.cjs without hosted state.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { settings, summarize, assertHealthy, realtimeFrame, messageFrame, assertPublicPayload, assertBindings, assertRealtime, assertTargetedRefreshes, monitor, resetIdentity, errorDetails, createFixtureClient, allowMembershipRequest } = require('./measure-room-performance.cjs');

const env = {
  E2E_TARGET: 'staging', E2E_PROJECT_REF: 'ciubrzggdqesgvfkpolj', E2E_APP_URL: 'http://localhost:3100',
  E2E_SUPABASE_URL: 'https://ciubrzggdqesgvfkpolj.supabase.co', E2E_SUPABASE_ANON_KEY: 'anonymous-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-test-key', SUPABASE_ACCESS_TOKEN: 'management-test-token'
};

test('identity reset clears persisted login before unloading the mounted application', async () => {
  const actions = [];
  const page = {
    evaluate: async callback => {
      assert.match(callback.toString(), /localStorage.clear\(\)/);
      actions.push('clear');
    },
    goto: async url => { actions.push(url); }
  };
  await resetIdentity(page);
  assert.deepEqual(actions, ['clear', 'about:blank']);
  await assert.rejects(resetIdentity({ ...page, evaluate: async () => { throw new Error('page closed'); } }), /page closed/);
});

test('cleanup diagnostics preserve PostgREST fields and native Error stacks', () => {
  const failure = { message: 'Foreign key violation', code: '23503', details: 'users referenced by sessions', hint: null };
  assert.deepEqual(errorDetails(failure), failure);
  const native = errorDetails(new Error('cleanup failed'));
  assert.equal(native.message, 'cleanup failed');
  assert.match(native.stack, /cleanup failed/);
  assert.deepEqual(errorDetails('offline'), { message: 'offline' });
});

test('fixture service client sends the existing practice write contract on every request', () => {
  const client = {};
  const result = createFixtureClient({ projectUrl: 'https://staging.supabase.co', serviceKey: 'test-service-key' }, (url, key, options) => {
    assert.equal(url, 'https://staging.supabase.co');
    assert.equal(key, 'test-service-key');
    assert.equal(options.global.headers['x-practice-contract'], 'cyberbullying-v2');
    assert.equal(options.auth.persistSession, false);
    return client;
  });
  assert.equal(result, client);
});

test('Edge routing allows the actual provider-free room join and blocks generation, analysis and preparation', () => {
  const url = 'https://staging.supabase.co/functions/v1/assessment-api';
  const join = JSON.stringify({ operation: 'join_room', room_id: 'fixture-room' });
  assert.equal(allowMembershipRequest(url, 'POST', join), true);
  for (const operation of ['analyze_message', 'prepare_assessment', 'prepare', 'post_message', 'cyberbullying_suggest', 'suggest_response', 'initialize_checklist']) {
    assert.equal(allowMembershipRequest(url, 'POST', JSON.stringify({ operation, room_id: 'fixture-room' })), false);
  }
  assert.equal(allowMembershipRequest(url.replace('assessment-api', 'ai-api'), 'POST', join), false);
  assert.equal(allowMembershipRequest(url, 'GET', join), false);
  assert.equal(allowMembershipRequest(url, 'POST', '{invalid'), false);
  assert.equal(allowMembershipRequest(url, 'POST', JSON.stringify({ operation: 'join_room' })), false);
});

test('preflight accepts explicit staging and rejects production, missing target, mismatched URL and invalid duration', () => {
  assert.equal(settings(env).windowMs, 60000);
  assert.equal(settings({ ...env, PERF_WINDOW_MS: '120000' }).windowMs, 120000);
  assert.throws(() => settings({ ...env, E2E_TARGET: undefined }), /Explicit/);
  assert.throws(() => settings({ ...env, E2E_TARGET: 'production' }), /Explicit/);
  assert.throws(() => settings({ ...env, E2E_PROJECT_REF: 'zgbufaxooqxeabewktzd', E2E_SUPABASE_URL: 'https://zgbufaxooqxeabewktzd.supabase.co' }), /Only the staging/);
  assert.throws(() => settings({ ...env, E2E_SUPABASE_URL: 'https://zgbufaxooqxeabewktzd.supabase.co' }), /does not match/);
  for (const duration of ['0', '59999', 'Infinity', 'oops', '60000.5']) {
    assert.throws(() => settings({ ...env, PERF_WINDOW_MS: duration }), /integer/);
  }
});

test('measurement windows count only included complete requests and normalize real duration', () => {
  const row = (started_ms, pathname, method, response_body_bytes) => ({ started_ms, pathname, method, response_body_bytes, status: 200 });
  const result = summarize([
    row(999, '/rest/v1/messages', 'GET', 10000),
    row(1000, '/rest/v1/messages', 'GET', 50),
    row(2000, '/rest/v1/messages', 'GET', 0),
    row(3000, '/rest/v1/message_feedback', 'GET', 25),
    row(4000, '/rest/v1/message_feedback', 'POST', 15),
    row(31000, '/rest/v1/messages', 'GET', 10000)
  ], 1000, 31000);
  assert.deepEqual(result.messages, { requests: 2, requests_per_minute: 4, response_body_bytes: 50 });
  assert.deepEqual(result.feedback, { requests: 1, requests_per_minute: 2, response_body_bytes: 25 });
  assert.deepEqual(result.all, { requests: 4, requests_per_minute: 8, response_body_bytes: 90 });
  for (const incomplete of [{ status: 500, response_body_bytes: 3 }, { status: 200 }, { status: 200, response_body_bytes: 0, failure: 'aborted' }, { status: 200, response_body_bytes: 0, capture_error: 'closed' }]) {
    assert.throws(() => summarize([{ started_ms: 1000, ...incomplete }], 1000, 31000));
  }
});

test('healthy bounds account for exact-page empty reads and reject old two-second polling and feedback reloads', () => {
  const summary = requests => ({ duration_ms: 60000, messages: { requests }, feedback: { requests: 0 } });
  assert.equal(assertHealthy(summary(22), 1000).maximum_message_requests, 22);
  assert.throws(() => assertHealthy(summary(23), 1000), /exceed/);
  assert.throws(() => assertHealthy(summary(30), 10), /exceed/);
  assert.throws(() => assertHealthy({ ...summary(1), duration_ms: 59999 }, 10), /60 seconds/);
  assert.throws(() => assertHealthy({ ...summary(1), feedback: { requests: 1 } }, 10), /reload feedback/);
});

test('only the expected missing offline identity lookup may return HTTP 406', () => {
  const identityMiss = { started_ms: 1, pathname: '/rest/v1/users', method: 'GET', status: 406,
    response_body: '{"code":"PGRST116"}', response_body_bytes: 20 };
  assert.equal(summarize([identityMiss], 0, 10).all.requests, 1);
  assert.throws(() => summarize([{ ...identityMiss, pathname: '/rest/v1/messages' }], 0, 10), /HTTP 406/);
  assert.throws(() => summarize([{ ...identityMiss, method: 'POST' }], 0, 10), /HTTP 406/);
  assert.throws(() => summarize([{ ...identityMiss, response_body: '{"code":"other"}' }], 0, 10), /HTTP 406/);
  assert.throws(() => summarize([{ ...identityMiss, status: 500 }], 0, 10), /HTTP 500/);
});

test('realtime proof requires matching row and event received before timely visibility', () => {
  const frame = { event: 'postgres_changes', payload: { data: { table: 'messages', type: 'INSERT', record: { id: 'one' } } } };
  assert.equal(messageFrame(JSON.stringify(frame)).message_id, 'one');
  assert.equal(messageFrame(JSON.stringify([null, null, 'topic', frame.event, frame.payload])).event, 'INSERT');
  assert.equal(messageFrame('heartbeat'), null);
  assert.equal(messageFrame(JSON.stringify({ ...frame, event: 'broadcast' })), null);
  const timing = { mutation_started_ms: 100, visible_ms: 500, after_write_ms: 300 };
  const events = [{ message_id: 'one', event: 'INSERT', received_ms: 200 }];
  assert.equal(assertRealtime(events, 'one', 'INSERT', timing).maximum_after_write_ms, 5000);
  assert.throws(() => assertRealtime([], 'one', 'INSERT', timing), /Missing/);
  assert.throws(() => assertRealtime(events, 'one', 'UPDATE', timing), /Missing/);
  assert.throws(() => assertRealtime(events, 'one', 'INSERT', { ...timing, visible_ms: 7000, after_write_ms: 6000 }), /exceeded/);
  assert.throws(() => assertRealtime(events, 'one', 'INSERT', { ...timing, visible_ms: 150 }), /Missing/);
});

test('rating refresh permits bounded dirty follow-ups only for the rated ID', () => {
  const targeted = { url: 'https://staging.supabase.co/rest/v1/message_feedback?message_id=in.(one)' };
  assertTargetedRefreshes([targeted], 'one');
  assertTargetedRefreshes([targeted, targeted, targeted], 'one');
  assert.throws(() => assertTargetedRefreshes([], 'one'), /1..3/);
  assert.throws(() => assertTargetedRefreshes(Array(4).fill(targeted), 'one'), /1..3/);
  assert.throws(() => assertTargetedRefreshes([{ url: targeted.url.replace('(one)', '(one,two)') }], 'one'), /only the rated/);
});

test('room binding proof requires all five event filters across three tables and rejects later system errors', () => {
  const bindings = [['messages', 'INSERT'], ['messages', 'UPDATE'], ['message_feedback', 'INSERT'], ['message_feedback', 'UPDATE'], ['rooms', 'UPDATE']]
    .map(([table, event]) => ({ table, event, schema: 'public', filter: `${table === 'rooms' ? 'id' : 'room_id'}=eq.room-one` }));
  const raw = { topic: 'realtime:room_room-one', event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: bindings } } };
  const acknowledgement = { ...realtimeFrame(JSON.stringify(raw)), received_ms: 100 };
  assert.equal(assertBindings([acknowledgement], 'room-one', 0, 200).acknowledgement.bindings.length, 5);
  assert.throws(() => assertBindings([{ ...acknowledgement, bindings: bindings.slice(1) }], 'room-one', 0, 200), /acknowledge/);
  assert.throws(() => assertBindings([{ ...acknowledgement, topic: 'realtime:room_other' }], 'room-one', 0, 200), /acknowledge/);
  assert.throws(() => assertBindings([acknowledgement, { topic: raw.topic, kind: 'system', received_ms: 150, payload: { status: 'error' } }], 'room-one', 0, 200), /system error/);
  const success = realtimeFrame(JSON.stringify({ topic: raw.topic, event: 'system', payload: { status: 'ok' } }));
  assert.equal(success.kind, 'system');
});

test('controlled feedback and room payloads retain values and reject nested private assessment keys', () => {
  const feedback = realtimeFrame(JSON.stringify({ topic: 'realtime:room_one', event: 'postgres_changes', payload: {
    data: { schema: 'public', table: 'message_feedback', type: 'UPDATE', record: { id: 'rating', rating: 4, message_id: 'message' } }
  } }));
  assert.equal(feedback.record.rating, 4);
  assert.equal(feedback.table, 'message_feedback');
  assert.equal(messageFrame(JSON.stringify({ event: 'postgres_changes', payload: { data: { table: 'rooms', record: { id: 'one' } } } })), null);
  assertPublicPayload(feedback);
  for (const key of ['correct_option_ids', 'answer_key', 'reviewed_private_payload']) {
    assert.throws(() => assertPublicPayload({ record: { nested: [{ [key]: ['secret'] }] } }), /Private assessment key/);
  }
  assert.throws(() => assertPublicPayload({ schema: 'private', record: { id: 'secret' } }), /Private schema/);
  assert.throws(() => assertRealtime([{ ...feedback, received_ms: 100 }], 'rating', 'UPDATE',
    { mutation_started_ms: 0, visible_ms: 200, after_write_ms: 100 }, 'rooms'), /Missing/);
});

test('monitor flush waits for requests started before the boundary even before response arrives', async () => {
  const page = new EventEmitter();
  const records = [];
  const flush = monitor(page, records, []);
  const request = { url: () => 'https://staging.supabase.co/rest/v1/messages', method: () => 'GET', postData: () => null };
  page.emit('request', request);
  let settled = false;
  const completion = flush(Date.now() + 1).then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  page.emit('response', { request: () => request, status: () => 200, body: async () => Buffer.from('actual response') });
  page.emit('requestfinished', request);
  await completion;
  assert.equal(records[0].response_body_bytes, 15);
  assert.equal(summarize(records, 0, Date.now() + 1).messages.response_body_bytes, 15);
});

test('page closure settles orphaned HTTP requests while preserving cancellation failure evidence', async () => {
  const page = new EventEmitter();
  const records = [];
  const flush = monitor(page, records, []);
  const request = { url: () => 'https://staging.supabase.co/rest/v1/rooms', method: () => 'GET', postData: () => null };
  page.emit('request', request);
  const completion = flush(Date.now() + 1);
  page.emit('response', { request: () => request, status: () => 200, body: () => new Promise(() => {}) });
  page.emit('close');
  await completion;
  assert.match(records[0].failure.errorText, /Page closed/);
  assert(Number.isInteger(records[0].cancelled_at_close_ms));
  assert.throws(() => summarize(records, 0, Date.now() + 1), /Request failed/);
});
