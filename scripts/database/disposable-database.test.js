#!/usr/bin/env node
// Tests disposable-database.js: local-only targeting, SQL quoting, parity scope and ownership-safe cleanup.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { connectionFromEnv, identifier, literal, setupSql, comparable, cleanup } = require('./disposable-database');

test('validation uses the existing local socket and rejects a network host', () => {
  assert.equal(connectionFromEnv({}).port, '55433');
  assert.match(connectionFromEnv({}).host, /migration-validation\/socket$/);
  assert.throws(() => connectionFromEnv({ PG_VALIDATION_HOST: 'production.example' }), /local Unix socket/);
  assert.throws(() => connectionFromEnv({ PG_VALIDATION_PORT: '55433;drop' }), /port/);
});

test('database setup quotes identifiers and preserves list/custom settings with embedded equals', () => {
  assert.equal(identifier('one"two'), '"one""two"');
  assert.equal(literal("one'two"), "'one''two'");
  const sql = setupSql('scenario"one', {
    owner: 'owner"one',
    acl: [{ grantee: null, privilege: 'CONNECT', grantable: false },
      { grantee: 'role"one', privilege: 'TEMPORARY', grantable: true }],
    settings: [{ role: null, values: ['search_path=public, extensions', "app.value=a=b'c"] },
      { role: 'role"one', values: ['statement_timeout=7s'] }]
  });
  assert.match(sql, /TO PUBLIC;/);
  assert.match(sql, /TO "role""one" WITH GRANT OPTION;/);
  assert.match(sql, /set_config\('search_path', 'public, extensions', false\)/);
  assert.match(sql, /set_config\('app.value', 'a=b''c', false\)/);
  assert.match(sql, /ALTER ROLE "role""one" IN DATABASE "scenario""one" SET "statement_timeout" FROM CURRENT/);
  assert.throws(() => setupSql('test', { owner: 'o', acl: [{ privilege: 'DROP' }], settings: [] }), /privilege/);
});

test('parity compares every database property except the fresh identity and ownership marker', () => {
  assert.deepEqual(comparable({ oid: 1, comment: 'source', acl: ['CONNECT'], settings: ['x'] }),
    comparable({ oid: 2, comment: 'owned', acl: ['CONNECT'], settings: ['x'] }));
  assert.notDeepEqual(comparable({ acl: ['CONNECT'], settings: ['x'] }), comparable({ acl: [], settings: ['x'] }));
});

test('cleanup fails closed for an active process, changed cluster, marker or database identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenario-owner-test-'));
  const leaseFile = path.join(root, 'lease.json');
  const lease = { database: 'agent_scenario_' + 'a'.repeat(24), host: os.hostname(), pid: process.pid,
    cluster: 'cluster-one', marker: 'owned', oid: 42 };
  fs.writeFileSync(leaseFile, JSON.stringify(lease));
  assert.throws(() => cleanup(leaseFile, { query: () => assert.fail('must not connect') }), /still running/);
  assert.throws(() => cleanup(leaseFile, { requireStopped: false, query: () => 'cluster-two' }), /cluster changed/);
  for (const current of [{ comment: 'other', oid: 42 }, { comment: 'owned', oid: 43 }]) {
    const query = sql => {
      if (sql.startsWith('select system_identifier')) return 'cluster-one';
      assert.ok(!sql.startsWith('DROP'), 'must not drop a database with mismatched ownership');
      return JSON.stringify(current);
    };
    assert.throws(() => cleanup(leaseFile, { query, requireStopped: false }), /refusing cleanup/);
  }
});
