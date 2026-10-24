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
