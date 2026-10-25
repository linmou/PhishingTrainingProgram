#!/usr/bin/env node
// Tests the publication migration against a verified hosted-baseline clone: Red/Green, preservation, permissions and atomic failure.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const migration = path.join(root, 'tutor-system/supabase/migrations/20261025034000_enable_message_realtime.sql');
const assertions = path.join(root, 'tutor-system/supabase/tests/message_realtime_publication.sql');
const psql = process.env.PG_VALIDATION_PSQL || '/opt/homebrew/opt/postgresql@17/bin/psql';
const operations = [];
const run = args => {
  const result = spawnSync(psql, ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-U', 'postgres', ...args], { encoding: 'utf8' });
  operations.push({ time: new Date().toISOString(), args, status: result.status, stdout: result.stdout, stderr: result.stderr });
  if (process.env.PG_VALIDATION_LEASE_FILE) {
    fs.writeFileSync(path.join(path.dirname(process.env.PG_VALIDATION_LEASE_FILE), 'publication-command-evidence.json'),
      JSON.stringify({ database: process.env.PGDATABASE, executor: 'postgres', operations }, null, 2) + '\n', { mode: 0o600 });
  }
  return result;
};
const query = sql => run(['-c', sql]);
const file = filename => run([...(filename === migration ? ['--single-transaction'] : []), '-f', filename]);
const succeed = result => { assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
const snapshot = () => succeed(query(`SET timezone='UTC'; SELECT jsonb_build_object(
  'messages',(SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM public.messages t),
  'feedback',(SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM public.message_feedback t),
  'rooms',(SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM public.rooms t),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','private')),
  'acl',(SELECT jsonb_agg(jsonb_build_object('name',oid::regclass::text,'owner',relowner,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity) ORDER BY oid::regclass::text) FROM pg_class WHERE oid IN ('public.messages'::regclass,'public.message_feedback'::regclass,'public.rooms'::regclass))
);`));

if (process.argv[2] === '--scenario') {
  const scenario = process.argv[3];
  const before = snapshot();
  if (scenario === 'red') {
    const red = file(assertions);
    assert.notEqual(red.status, 0);
    assert.match(red.stderr, /MESSAGE_REALTIME_MEMBERSHIP_REQUIRED/);
    console.log('Expected Red: MESSAGE_REALTIME_MEMBERSHIP_REQUIRED');
  } else if (scenario === 'green') {
    succeed(file(migration));
    succeed(file(assertions));
    assert.equal(snapshot(), before, 'Migration must preserve existing rows, policies and ACLs');
    const repeated = file(migration);
    assert.notEqual(repeated.status, 0);
    assert.match(repeated.stderr, /42710/);
    succeed(file(assertions));
    assert.equal(snapshot(), before, 'Duplicate application must preserve publication membership, rows, policies and ACLs');
    console.log('Green: exact membership, anon/authenticated/service permissions, existing rows and ACLs preserved; duplicate application fails atomically with 42710');
  } else if (scenario === 'atomic') {
    succeed(query('ALTER TABLE public.message_feedback RENAME TO message_feedback_unavailable;'));
    const failed = file(migration);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /42P01/);
    assert.equal(succeed(query("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime';")), '0');
    succeed(query('ALTER TABLE public.message_feedback_unavailable RENAME TO message_feedback;'));
    assert.equal(snapshot(), before);
    console.log('Atomic failure: missing second table leaves messages unpublished and existing rows unchanged');
  } else throw new Error('Unknown scenario');
} else {
  test('message Realtime publication on verified disposable baselines', {
    skip: !process.env.PG_REALTIME_VERIFIED_BASELINE
  }, async t => {
    for (const scenario of ['red', 'green', 'atomic']) {
      await t.test(scenario, () => {
        const result = spawnSync(process.execPath, [path.join(__dirname, 'disposable-database.js'),
          '--template', process.env.PG_REALTIME_VERIFIED_BASELINE, '--', process.execPath, __filename, '--scenario', scenario], {
          encoding: 'utf8', env: process.env
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        process.stdout.write(result.stdout);
      });
    }
  });
}
