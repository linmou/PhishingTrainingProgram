#!/usr/bin/env node
// Responsibility: verify staging-only preflight and measurement accounting in measure-room-performance.cjs without hosted state.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { settings, summarize } = require('./measure-room-performance.cjs');

const env = {
  E2E_TARGET: 'staging', E2E_PROJECT_REF: 'ciubrzggdqesgvfkpolj', E2E_APP_URL: 'http://localhost:3100',
  E2E_SUPABASE_URL: 'https://ciubrzggdqesgvfkpolj.supabase.co', E2E_SUPABASE_ANON_KEY: 'anonymous-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-test-key', SUPABASE_ACCESS_TOKEN: 'management-test-token'
};

test('preflight accepts explicit staging and rejects production, missing target, mismatched URL and invalid duration', () => {
  assert.equal(settings(env).windowMs, 60000);
  assert.equal(settings({ ...env, PERF_WINDOW_MS: '1000' }).windowMs, 1000);
  assert.throws(() => settings({ ...env, E2E_TARGET: undefined }), /Explicit/);
  assert.throws(() => settings({ ...env, E2E_TARGET: 'production' }), /Explicit/);
  assert.throws(() => settings({ ...env, E2E_PROJECT_REF: 'zgbufaxooqxeabewktzd', E2E_SUPABASE_URL: 'https://zgbufaxooqxeabewktzd.supabase.co' }), /Only the staging/);
  assert.throws(() => settings({ ...env, E2E_SUPABASE_URL: 'https://zgbufaxooqxeabewktzd.supabase.co' }), /does not match/);
  for (const duration of ['0', '999', 'Infinity', 'oops', '1000.5']) {
    assert.throws(() => settings({ ...env, PERF_WINDOW_MS: duration }), /integer/);
  }
});

test('measurement windows count only included requests and normalize real duration, including failed requests', () => {
  const row = (started_ms, pathname, method, response_body_bytes) => ({ started_ms, pathname, method, response_body_bytes });
  const result = summarize([
    row(999, '/rest/v1/messages', 'GET', 10000),
    row(1000, '/rest/v1/messages', 'GET', 50),
    row(2000, '/rest/v1/messages', 'GET', undefined),
    row(3000, '/rest/v1/message_feedback', 'GET', 25),
    row(4000, '/rest/v1/message_feedback', 'POST', 15),
    row(31000, '/rest/v1/messages', 'GET', 10000)
  ], 1000, 31000);
  assert.deepEqual(result.messages, { requests: 2, requests_per_minute: 4, response_body_bytes: 50 });
  assert.deepEqual(result.feedback, { requests: 1, requests_per_minute: 2, response_body_bytes: 25 });
  assert.deepEqual(result.all, { requests: 4, requests_per_minute: 8, response_body_bytes: 90 });
});
