#!/usr/bin/env node
// Tests the browser-draft migration and shared reviewed send against an owned disposable database, including concurrent submissions and cutover draining.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '../../..');
const database = process.env.MIGRATION_TEST_DB;
assert(database && database === process.env.PGDATABASE, 'Use scripts/database/disposable-database.js');
assert(process.env.PGHOST?.startsWith('/'), 'Only the existing local cluster is allowed');
const psql = '/opt/homebrew/opt/postgresql@17/bin/psql';
const migration = 'tutor-system/supabase/migrations/20261021010000_cyberbullying_browser_draft.sql';
const suite = 'tutor-system/supabase/tests/cyberbullying_browser_draft.sql';
const report = { database, migration_sha256: createHash('sha256').update(fs.readFileSync(path.join(root, migration))).digest('hex'), checks: [] };
function sql(args) {
  const result = spawnSync(psql, ['-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', ...args], { cwd: root, encoding: 'utf8' });
  report.checks.push({ args, status: result.status, stdout: result.stdout, stderr: result.stderr });
  return result;
}
async function concurrentSend() {
  const config = { host: process.env.PGHOST, port: Number(process.env.PGPORT), user: 'postgres', database };
  const admin = new Client(config), first = new Client(config), second = new Client(config);
  const tutor = randomUUID(), learner = randomUUID(), room = randomUUID(), parent = randomUUID();
  async function blocked(pid) {
    for (let i = 0; i < 100; i++) {
      if ((await admin.query('select cardinality(pg_blocking_pids($1))>0 blocked', [pid])).rows[0].blocked) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected room serialization');
  }
  try {
    await Promise.all([admin.connect(), first.connect(), second.connect()]);
    await admin.query('update private.practice_write_gate set closed=false where singleton');
    await admin.query('insert into users(id,display_name,"current_role",status) values($1,\'Concurrent tutor\',\'tutor\',\'active\'),($2,\'Concurrent learner\',\'student\',\'active\')', [tutor, learner]);
    await admin.query('insert into rooms(id,tutor_id,title,practice_type,scenario_config) values($1,$2,\'Concurrent draft fixture\',\'cyberbullying\',$3)',
      [room, tutor, { id: 'fixture', source_commit: 'fixture', post: { text: 'Fixture', image: '/fixture.png', author: { id: 'author', name: 'Author' } }, initial_comments: [] }]);
    await admin.query('select join_room_v1($1,$2)', [room, learner]);
    await admin.query('insert into messages(id,room_id,user_id,user_role,content) values($1,$2,$3,\'student\',\'Learner comment\')', [parent, room, learner]);
    for (const client of [first, second]) await client.query('set role anon; set request.headers=\'{"x-practice-contract":"cyberbullying-v2"}\'');
    const pid = (await second.query('select pg_backend_pid() pid')).rows[0].pid;
    const query = 'select send_reviewed_tutor_response($1,$2,$3,\'Reply\',false,NULL,\'Support\',false,\'Reply\',\'accepted\',1,\'[]\',\'victim\',\'victim\',NULL) result';
    await first.query('begin');
    const sent = (await first.query(query, [room, tutor, parent])).rows[0].result;
    const pending = second.query(query, [room, tutor, parent]);
    await blocked(pid);
    await first.query('commit');
    const repeated = (await pending).rows[0].result;
    // Inherited ordinary-send behavior: separate submissions each publish, without proposal replay semantics.
    assert.notEqual(sent.message.id, repeated.message.id);
    const counts = (await admin.query('select (select count(*)::int from messages where room_id=$1 and user_role=\'tutor\') messages,(select count(*)::int from ai_suggestion_feedback where room_id=$1) reviews', [room])).rows[0];
    assert.deepEqual(counts, { messages: 2, reviews: 2 });
    report.checks.push({ operation: 'concurrent_shared_send', serialized: true, ...counts });
    await first.query('begin');
    await first.query('update users set display_name=display_name where id=$1', [learner]);
    await second.query('reset role');
    const gate = second.query(fs.readFileSync(path.join(root, 'tutor-system/scripts/database/practice-write-gate.sql'), 'utf8'));
    await blocked(pid);
    await first.query('commit');
    await gate;
    await assert.rejects(first.query('update users set display_name=display_name where id=$1', [learner]), error => error.code === '55000' && error.message.startsWith('PRACTICE_MAINTENANCE'));
    report.checks.push({ operation: 'cutover_drain', waited_for_write: true, subsequent_write_blocked: true });
  } finally {
    await Promise.all([first.query('rollback').catch(() => {}), second.query('rollback').catch(() => {})]);
    await admin.query('delete from rooms where id=$1', [room]);
    await admin.query('delete from users where id=any($1::uuid[])', [[tutor, learner]]);
    const remaining = (await admin.query('select count(*)::int count from messages where room_id=$1', [room])).rows[0].count;
    assert.equal(remaining, 0);
    await Promise.all([admin.end(), first.end(), second.end()]);
  }
}
async function main() {
  const red = sql(['-f', suite]);
  assert.notEqual(red.status, 0);
  assert.match(red.stderr, /proposal storage must be retired/);
  const green = sql(['-c', 'UPDATE private.practice_write_gate SET closed=true WHERE singleton;', '-f', migration, '-f', suite,
    '-f', 'tutor-system/supabase/tests/cyberbullying_practise.sql']);
  assert.equal(green.status, 0, green.stderr);
  await concurrentSend();
  report.status = 'passed';
  console.log(JSON.stringify({ database, status: report.status, migration_sha256: report.migration_sha256, checks: report.checks.length }));
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1; }).finally(() => {
  const destination = path.join(root, 'tutor-system/output/browser-draft');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, `local-${database}.json`), JSON.stringify(report, null, 2));
});
