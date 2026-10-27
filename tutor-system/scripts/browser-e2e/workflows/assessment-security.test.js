// Probe preflight and verdict logic only. These checks never establish live security coverage.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const security = require('./assessment-security');
const { selectWorkflows } = require('../../browser-e2e');
test('security workflow is opt-in and rejects production before touching any fixtures', async () => {
  assert(!selectWorkflows([]).includes('assessment-security'));
  assert.deepEqual(selectWorkflows(['--workflow=assessment-security']), ['assessment-security']);
  await assert.rejects(security({ config: { projectRef: 'zgbufaxooqxeabewktzd' },
    existingRoom: () => { throw new Error('must not touch fixture'); } }), /staging-only/);
  assert.throws(() => security.assertStaging({ projectRef: 'ciubrzggdqesgvfkpolj', projectUrl: 'https://other.supabase.co' }), /staging-only/);
});
test('successful impersonation, server errors and irrelevant validation failures cannot pass a denial probe', () => {
  for (const response of [ { status: 200, body: { ok: true } }, { status: 500, body: { error: { code: 'FORBIDDEN' } } },
    { status: 400, body: { error: { code: 'INVALID_REQUEST' } } }, { status: 503, body: { error: { code: 'ASSESSMENT_FEATURE_DISABLED' } } } ]) {
    assert.throws(() => security.assertDenied(response, ['FORBIDDEN', 'UNAUTHORIZED']));
  }
  security.assertDenied({ status: 403, body: { error: { code: 'FORBIDDEN' } } }, ['FORBIDDEN']);
});

// assessment-security.js: denial diagnostics retain bounded codes without copying private response bodies.
test('unexpected denial diagnostics expose only a bounded error code', () => {
  assert.throws(() => security.assertDenied({ status: 409, body: {
    error: { code: 'ASSESSMENT_NOT_OPEN', message: 'private review body' }
  } }, ['FORBIDDEN']), /Unexpected denial code ASSESSMENT_NOT_OPEN/);
  for (const code of ['private review body', 'A'.repeat(65), { private_payload: 'private review body' }]) {
    assert.throws(() => security.assertDenied({ status: 409, body: { error: { code } } }, ['FORBIDDEN']),
      error => error.message.includes('UNRECOGNIZED') && !error.message.includes('private review body'));
  }
});

test('state oracle failure before an attack is persisted and prevents the attack', async () => {
  const row = { id: 'forged_identity', status: 'blocked', reason: 'not_run' };
  let attacked = false;
  let saved;
  await assert.rejects(security.runProbe(row, async () => { throw new Error('unavailable'); },
    async () => { attacked = true; }, () => { saved = structuredClone(row); }, () => undefined), /oracle failed before/);
  assert.equal(attacked, false);
  assert.equal(saved.status, 'fail');
  assert.match(saved.state_verification_error, /before attack/);
});

test('losing the state oracle after a rejected attack preserves both failures', async () => {
  const row = { id: 'forged_identity' };
  let reads = 0;
  let saved;
  await assert.rejects(security.runProbe(row, async () => {
    if (++reads === 1) return 'before-hash';
    throw new Error('unavailable');
  }, async () => { throw new Error('Expected denial, received HTTP 200'); },
  () => { saved = structuredClone(row); }, () => 200), /oracle failed after/);
  assert.equal(saved.status, 'fail');
  assert.match(saved.error, /HTTP 200/);
  assert.match(saved.state_verification_error, /after attack/);
  assert.equal(saved.http_status, 200);
});

test('RLS-filtered HTTP success still fails if persisted state changed', async () => {
  const row = { id: 'direct_write' };
  let reads = 0;
  let saved;
  await security.runProbe(row, async () => ++reads === 1 ? 'before' : 'changed', async () => {},
    () => { saved = structuredClone(row); }, () => 200);
  assert.equal(saved.status, 'fail');
  assert.equal(saved.error, 'Attack mutated persisted state');
});

test('unchanged persisted state cannot turn accepted impersonation into a passing probe', async () => {
  const row = { id: 'forged_identity' };
  let saved;
  await security.runProbe(row, async () => 'same', async () => {
    security.assertDenied({ status: 200, body: { ok: true, data: { private_payload: 'do not persist' } } }, ['FORBIDDEN']);
  }, () => { saved = structuredClone(row); }, () => 200);
  assert.equal(saved.status, 'fail');
  assert(!JSON.stringify(saved).includes('do not persist'));
});

test('a matching authorization denial and unchanged state records a passing probe result', async () => {
  const row = { id: 'cross_room', status: 'blocked', reason: 'not_run' };
  let saved;
  await security.runProbe(row, async () => 'same', async () => {
    security.assertDenied({ status: 403, body: { error: { code: 'FORBIDDEN' } } }, ['FORBIDDEN']);
  }, () => { saved = structuredClone(row); }, () => 403);
  assert.equal(saved.status, 'pass');
  assert.equal(saved.reason, undefined);
  assert.equal(saved.state_after, saved.state_before);
});

test('a nested subcheck losing its state oracle stops the enclosing attack sequence', async () => {
  const parent = { id: 'direct_write' }; const child = { id: 'authenticated_result' };
  let childReads = 0; let laterRan = false; let saved;
  await assert.rejects(security.runProbe(parent, async () => 'parent-state', async () => {
    await security.runProbe(child, async () => {
      if (++childReads === 1) return 'child-state';
      throw new Error('oracle unavailable');
    }, async () => {}, () => {}, () => 403);
    laterRan = true;
  }, () => { saved = structuredClone(parent); }, () => 403), /subcheck/i);
  assert.equal(laterRan, false);
  assert.equal(saved.status, 'fail');
  assert.equal(child.status, 'fail');
});
