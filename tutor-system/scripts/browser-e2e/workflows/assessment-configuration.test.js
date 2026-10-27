#!/usr/bin/env node
// Test responsibility: verify assessment-configuration.js restores exact state on failure and retains unsafe-cleanup errors.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { withFlagDisabled } = require('./assessment-configuration');

test('configuration drill is opt-in and rejects production before fixture access', async () => {
  const { selectWorkflows } = require('../../browser-e2e');
  assert(!selectWorkflows([]).includes('assessment-configuration'));
  assert.deepEqual(selectWorkflows(['--workflow=assessment-configuration']), ['assessment-configuration']);
  await assert.rejects(require('./assessment-configuration')({
    config: { projectRef: 'zgbufaxooqxeabewktzd', projectUrl: 'https://zgbufaxooqxeabewktzd.supabase.co' },
  }), /staging-only/);
});

function client(original, failRestore = false) {
  const state = { enabled: original, writes: [] };
  return { state, from() {
    return {
      select() { return { eq() { return { single: async () => ({ data: { enabled: state.enabled }, error: null }) }; } }; },
      update({ enabled }) { return { eq() { return { select() { return { single: async () => {
        state.writes.push(enabled);
        if (failRestore && state.writes.length > 1) return { data: null, error: { message: 'update failed' } };
        state.enabled = enabled; return { data: { enabled }, error: null };
      } }; } }; } }; },
    };
  } };
}

test('restores both explicit boolean values after a failed drill', async () => {
  for (const original of [true, false]) {
    const fixture = client(original);
    await assert.rejects(withFlagDisabled(fixture, async observed => {
      assert.equal(observed, original); assert.equal(fixture.state.enabled, false); throw Error('probe failed');
    }), /probe failed/);
    assert.equal(fixture.state.enabled, original);
    assert.deepEqual(fixture.state.writes, [false, original]);
  }
});

test('unreadable original configuration prevents any mutation', async () => {
  for (const original of [undefined, null, 'true']) {
    const fixture = client(original);
    await assert.rejects(withFlagDisabled(fixture, async () => assert.fail('must not probe')), /configuration is unavailable/);
    assert.deepEqual(fixture.state.writes, []);
  }
});

test('restoration failure tells the browser runner to retain the shared lease', async () => {
  const fixture = client(true, true);
  await assert.rejects(withFlagDisabled(fixture, async () => {}), error => error.cleanupFailed === true);
  assert.equal(fixture.state.enabled, false);
});
