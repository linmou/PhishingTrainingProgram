#!/usr/bin/env node
// Tests staging-coordination.js: cross-machine exclusion, token-safe release, nested ownership and uncertain claim failures.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { STAGING, LEASE_ENV, acquireProjectLock } = require('./staging-coordination');

function githubFixture() {
  const tags = new Map();
  let held;
  const api = (method, endpoint, body) => {
    if (endpoint.endsWith('/git/ref/heads/no_sign_up')) return { object: { sha: 'baseline' } };
    if (method === 'POST' && endpoint.endsWith('/git/tags')) {
      const sha = crypto.randomUUID();
      tags.set(sha, body);
      return { sha };
    }
    if (method === 'POST' && endpoint.endsWith('/git/refs')) {
      if (held) throw new Error('HTTP 422 reference already exists');
      held = body.sha;
      return {};
    }
    if (method === 'GET' && endpoint.includes('/git/ref/tags/')) return { object: { sha: held } };
    if (method === 'GET' && endpoint.includes('/git/tags/')) return tags.get(endpoint.split('/').pop());
    if (method === 'DELETE') { held = undefined; return null; }
    throw new Error('Unexpected GitHub request');
  };
  return { api, replace: sha => { held = sha; } };
}

const directory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'staging-coordination-test-'));
const options = (fixture, extra = {}) => ({ operation: 'test', commit: 'candidate', evidenceDir: directory(), env: {}, api: fixture.api, ...extra });

test('two machines contend on the same atomic reference; release permits reacquisition', () => {
  const fixture = githubFixture();
  const first = acquireProjectLock(STAGING, options(fixture));
  assert.throws(() => acquireProjectLock(STAGING, options(fixture)), /lease unavailable/);
  first.release();
  assert.equal(JSON.parse(fs.readFileSync(first.leaseFile)).status, 'released');
  const next = acquireProjectLock(STAGING, options(fixture));
  assert.notEqual(next.owner.token, first.owner.token);
  next.release();
});

test('changed reference or nested candidate fails closed without removing the current owner', () => {
  const fixture = githubFixture();
  const first = acquireProjectLock(STAGING, options(fixture));
  const env = { [LEASE_ENV]: first.leaseFile };
  assert.throws(() => acquireProjectLock(STAGING, options(fixture, { env, commit: 'another-candidate' })), /another candidate/);
  const nested = acquireProjectLock(STAGING, options(fixture, { env }));
  assert.equal(nested.borrowed, true);
  nested.release();
  assert.throws(() => acquireProjectLock(STAGING, options(fixture)), /lease unavailable/);
  fixture.replace('another-owner');
  assert.throws(() => first.release(), /ownership changed/);
  assert.equal(JSON.parse(fs.readFileSync(first.leaseFile)).status, 'held');
});

test('a lost claim response retains evidence and never deletes a possibly acquired reference', () => {
  const fixture = githubFixture();
  const evidenceDir = directory();
  const api = (method, endpoint, body) => {
    const result = fixture.api(method, endpoint, body);
    if (method === 'POST' && endpoint.endsWith('/git/refs')) throw new Error('response lost');
    return result;
  };
  assert.throws(() => acquireProjectLock(STAGING, options(fixture, { api, evidenceDir })), /lease unavailable/);
  const lease = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'coordination-lease.json')));
  assert.equal(lease.status, 'claim-failed');
  assert.throws(() => acquireProjectLock(STAGING, options(fixture)), /lease unavailable/);
});
