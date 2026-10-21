'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { acquireFixtureLock } = require('./fixture-lock');

function withRoot(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ptp-fixture-lock-test-'));
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('shared-project lock excludes another worktree process and can be reacquired', () => withRoot(root => {
  const first = acquireFixtureLock('staging-test', { lockRoot: root, runId: 'run_a' });
  const childScript = [
    "const { acquireFixtureLock } = require(process.argv[1]);",
    "acquireFixtureLock('staging-test', { lockRoot: process.argv[2], runId: 'run_b' });"
  ].join('\n');
  const competing = spawnSync(process.execPath, ['-e', childScript, require.resolve('./fixture-lock'), root], { encoding: 'utf8' });
  assert.notEqual(competing.status, 0);
  assert.match(competing.stderr, /fixtures are locked/);
  assert.match(competing.stderr, /run=run_a/);
  first.release();
  const next = acquireFixtureLock('staging-test', { lockRoot: root, runId: 'run_b' });
  next.release();
}));

test('different hosted projects may run on the same host', () => withRoot(root => {
  const a = acquireFixtureLock('project-a', { lockRoot: root, runId: 'a' });
  const b = acquireFixtureLock('project-b', { lockRoot: root, runId: 'b' });
  b.release();
  a.release();
}));

test('ownership mismatch refuses cleanup and retains the lock', () => withRoot(root => {
  const held = acquireFixtureLock('staging-test', { lockRoot: root, runId: 'original' });
  const marker = path.join(held.directory, 'owner.json');
  const modified = JSON.parse(fs.readFileSync(marker, 'utf8'));
  modified.run_id = 'different-run';
  fs.writeFileSync(marker, JSON.stringify(modified));
  assert.throws(() => held.release(), /ownership changed/);
  assert.ok(fs.existsSync(held.directory));
}));

test('stale locks are never silently reclaimed, invalid paths are rejected', () => withRoot(root => {
  const held = acquireFixtureLock('staging-test', { lockRoot: root, runId: 'stale' });
  assert.throws(() => acquireFixtureLock('staging-test', { lockRoot: root }), /locked/);
  assert.throws(() => acquireFixtureLock('../production', { lockRoot: root }), /safe Supabase/);
  held.release();
}));
