#!/usr/bin/env node
// Responsibility: verify browser-e2e-support cleanup SQL uses guarded, transaction-local transfer writes after fixture ownership checks.
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { cleanupRoom, cleanupCreatedRoom, ROOMS } = require('./browser-e2e-support');
const config = { projectRef: 'mock-project', accessToken: 'mock-token' };
const roomId = ROOMS['assessment-delivery'].id;
const tutorId = '11111111-1111-4111-8111-111111111111';

async function withManagement(room, run) {
  const original = global.fetch;
  const queries = [];
  global.fetch = async (_url, options) => {
    const sql = JSON.parse(options.body).query;
    queries.push(sql);
    let rows = [];
    if (sql.startsWith('select description') || sql.startsWith('select tutor_id')) rows = [room];
    else if (sql.startsWith('select count')) rows = [{ count: 0 }];
    else if (sql.startsWith('select guard_mode')) rows = [{ guard_mode: false, guard_mode_changed_at: null, guard_mode_change_source: null }];
    else if (sql.startsWith('delete from public.rooms')) rows = [{ id: roomId }];
    return { ok: true, json: async () => rows };
  };
  try { await run(queries); } finally { global.fetch = original; }
}

function assertGuardedTransaction(sql) {
  const statements = sql.trim().split(';').map(value => value.trim().replace(/\s+/g, ' '));
  assert.equal(statements[0], "do $$ begin perform set_config('app.transfer_operation', 'on', true)");
  assert(statements.slice(1).some(value => value.startsWith('delete from ')));
  assert(statements.at(-1) === '');
  assert(sql.includes(`'${roomId}'::uuid`));
}

test('template cleanup enables guarded deletes inside its transaction and retains all readbacks', async () => {
  await withManagement({ description: '[browser-e2e-template]' }, async queries => {
    await cleanupRoom(config, roomId);
    assert.equal(queries[0], `select description from public.rooms where id='${roomId}'::uuid`);
    assertGuardedTransaction(queries[1]);
    assert(queries[1].includes('delete from public.session_checklists'));
    assert.equal(queries.filter(sql => sql.startsWith('select count')).length, 8);
    assert(queries.at(-1).startsWith('select guard_mode'));
  });
});

test('created-room cleanup guards explicit and cascading checklist deletes after owner validation', async () => {
  for (const practice_type of ['phishing', 'cyberbullying']) {
    await withManagement({ tutor_id: tutorId, description: '[browser-e2e-created]', practice_type }, async queries => {
      await cleanupCreatedRoom(config, roomId, tutorId);
      assert(queries[0].startsWith('select tutor_id'));
      assertGuardedTransaction(queries[1]);
      if (practice_type === 'cyberbullying') {
        assert(queries[1].includes(`and tutor_id='${tutorId}'::uuid`));
        assert(queries[1].includes('if not found then raise exception'));
        assert.equal(queries.filter(sql => sql.startsWith('select count')).length, 8);
      } else assert(queries[1].includes('delete from public.session_checklists'));
    });
  }
});

test('cleanup rejects unmarked rooms and foreign owners before any mutation', async () => {
  await withManagement({ description: 'ordinary room' }, async queries => {
    await assert.rejects(cleanupRoom(config, roomId), /non-template/);
    assert.equal(queries.length, 1);
  });
  for (const room of [
    { tutor_id: '22222222-2222-4222-8222-222222222222', description: '[browser-e2e-created]' },
    { tutor_id: tutorId, description: 'ordinary room' }
  ]) {
    await withManagement(room, async queries => {
      await assert.rejects(cleanupCreatedRoom(config, roomId, tutorId));
      assert.equal(queries.length, 1);
    });
  }
});
