#!/usr/bin/env node
'use strict';
// Opt-in: requires a freshly restored, independently verified hosted baseline.
// A skip is a blocker, never evidence that migration or websocket delivery passed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const migration = path.join(root, 'tutor-system/supabase/migrations/20261112180000_enable_learning_progress_realtime.sql');
const assertions = path.join(root, 'tutor-system/supabase/tests/learning_progress_realtime_publication.sql');
const tables = ['sessions', 'session_checklists', 'checklist_items', 'coverage_evidence'];
const psql = process.env.PG_VALIDATION_PSQL || '/opt/homebrew/opt/postgresql@17/bin/psql';
const executor = process.env.PG_LEARNING_REALTIME_EXECUTOR;
const operations = [];
const run = args => {
  const result = spawnSync(psql, ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-U', executor, ...args], { encoding: 'utf8' });
  operations.push({ args, status: result.status, stdout: result.stdout, stderr: result.stderr });
  fs.writeFileSync(path.join(path.dirname(process.env.PG_VALIDATION_LEASE_FILE), 'learning-realtime-evidence.json'),
    JSON.stringify({ executor, database: process.env.PGDATABASE, operations }, null, 2), { mode: 0o600 });
  return result;
};
const query = sql => run(['-c', sql]);
const file = filename => run(['--single-transaction', '-f', filename]);
const ok = result => { assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
const membership = () => ok(query("SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename) FROM pg_publication_tables p WHERE pubname='supabase_realtime';"));
const snapshot = () => ok(query(`SELECT jsonb_build_object(
  'rows',jsonb_build_array(${tables.map(t => `(SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM public.${t} t)`).join(',')}),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','private')),
  'acl',(SELECT jsonb_agg(jsonb_build_object('name',oid::regclass::text,'owner',relowner,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'identity',relreplident) ORDER BY oid::regclass::text) FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'private'::regnamespace)),
  'publication',(SELECT to_jsonb(p) FROM pg_publication p WHERE pubname='supabase_realtime')
);`));
if (process.argv[2] === '--scenario') {
  assert.ok(executor, 'Use the executor verified through MCP');
  assert.ok(process.env.PG_VALIDATION_LEASE_FILE, 'Run only through disposable-database.js');
  const scenario = process.argv[3];
  // Deliberately remove only these memberships on this owned disposable clone.
  // This tests the candidate even if a target already has some memberships.
  for (const table of tables) {
    if (ok(query(`SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='${table}';`)) !== '0') {
      ok(query(`ALTER PUBLICATION supabase_realtime DROP TABLE public.${table};`));
    }
  }
  const before = snapshot();
  const beforeMembers = membership();
  if (scenario === 'red-green') {
    const red = file(assertions);
    assert.notEqual(red.status, 0);
    assert.match(red.stderr, /LEARNING_REALTIME_MEMBERSHIP_REQUIRED/);
    ok(file(migration));
    ok(file(assertions));
    assert.equal(snapshot(), before, 'Rows, policies, permissions, replica identity and publication options unchanged');
    const members = JSON.parse(membership());
    for (const member of JSON.parse(beforeMembers || 'null') || []) assert.ok(members.some(m => JSON.stringify(m) === JSON.stringify(member)), 'Unrelated membership unchanged');
    const afterMembers = membership();
    ok(file(migration));
    assert.equal(membership(), afterMembers, 'Reapplication is idempotent');
    assert.equal(snapshot(), before);
    // Exercise the existing read/DDL/private boundary under each browser role.
    for (const role of ['anon', 'authenticated']) {
      ok(query(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claims','{"role":"${role}"}',true);
        SELECT id FROM public.sessions LIMIT 1;
        SELECT id FROM public.session_checklists LIMIT 1;
        SELECT id FROM public.checklist_items LIMIT 1;
        SELECT id FROM public.coverage_evidence LIMIT 1; ROLLBACK;`));
      for (const forbidden of ['SELECT id FROM private.transfer_assessments LIMIT 1', 'ALTER PUBLICATION supabase_realtime DROP TABLE public.checklist_items',
        'SELECT public.read_learning_evidence_v1(NULL,NULL,NULL)']) {
        const denied = query(`BEGIN; SET LOCAL ROLE ${role}; ${forbidden}; ROLLBACK;`);
        assert.notEqual(denied.status, 0);
        assert.match(denied.stderr, /permission denied|must be owner/);
      }
    }
    assert.equal(snapshot(), before);
    assert.equal(membership(), afterMembers);
    // Use actual restored learner/tutor rows, isolate all fixture writes in a rollback.
    ok(query(`BEGIN;
      SET LOCAL app.transfer_operation = 'on';
      SET LOCAL request.headers = '{"x-practice-contract":"cyberbullying-v2"}';
      DO $test$
      DECLARE c public.session_checklists%ROWTYPE; i uuid; other_item uuid;
        teacher uuid; outsider uuid; evidence uuid := gen_random_uuid();
        before_time timestamptz; after_time timestamptz; other_time timestamptz; rows jsonb;
      BEGIN
        SELECT sc.* INTO c FROM public.session_checklists sc
          JOIN public.users u ON u.id=sc.student_id AND u.status='active'
          JOIN public.rooms r ON r.id=sc.room_id
          JOIN public.users tutor ON tutor.id=r.tutor_id AND tutor.status='active'
          WHERE sc.is_active AND sc.progress_policy_version='transfer_v1'
            AND (SELECT count(*) FROM public.checklist_items ci WHERE ci.checklist_id=sc.id AND NOT ci.deleted)>1
          LIMIT 1;
        IF c.id IS NULL THEN RAISE EXCEPTION 'RESTORED_LEARNER_FIXTURE_REQUIRED'; END IF;
        SELECT tutor_id INTO teacher FROM public.rooms WHERE id=c.room_id;
        SELECT id INTO outsider FROM public.users WHERE id NOT IN (teacher,c.student_id) AND status='active' LIMIT 1;
        IF outsider IS NULL THEN RAISE EXCEPTION 'RESTORED_OUTSIDER_REQUIRED'; END IF;
        SELECT id,updated_at INTO i,before_time FROM public.checklist_items
          WHERE checklist_id=c.id AND NOT deleted ORDER BY id LIMIT 1;
        SELECT id,updated_at INTO other_item,other_time FROM public.checklist_items
          WHERE checklist_id=c.id AND NOT deleted AND id<>i ORDER BY id LIMIT 1;
        UPDATE public.rooms SET guard_mode=false WHERE id=c.room_id;
        SET LOCAL ROLE service_role;
        INSERT INTO public.coverage_evidence(id,item_id,evidence_text,analysis,confidence_score,detection_method)
          VALUES(evidence,i,'integration fixture','integration fixture',100,'tutor_manual');
        SELECT updated_at INTO after_time FROM public.checklist_items WHERE id=i;
        IF after_time IS NOT DISTINCT FROM before_time THEN RAISE EXCEPTION 'INSERT_INVALIDATION_MISSING'; END IF;
        SET LOCAL ROLE service_role;
        rows := public.read_learning_evidence_v1(c.room_id,c.id,c.student_id);
        IF NOT EXISTS(SELECT FROM jsonb_array_elements(rows) e WHERE e->>'id'=evidence::text) THEN
          RAISE EXCEPTION 'LEARNER_EVIDENCE_MISSING'; END IF;
        rows := public.read_learning_evidence_v1(c.room_id,c.id,teacher);
        IF NOT EXISTS(SELECT FROM jsonb_array_elements(rows) e WHERE e->>'id'=evidence::text) THEN
          RAISE EXCEPTION 'TUTOR_EVIDENCE_MISSING'; END IF;
        BEGIN
          PERFORM public.read_learning_evidence_v1(c.room_id,c.id,outsider);
          RAISE EXCEPTION 'PEER_OR_OBSERVER_READ_ALLOWED';
        EXCEPTION WHEN insufficient_privilege THEN NULL; END;
        BEGIN
          PERFORM public.read_learning_evidence_v1(gen_random_uuid(),c.id,teacher);
          RAISE EXCEPTION 'CROSS_ROOM_READ_ALLOWED';
        EXCEPTION WHEN insufficient_privilege THEN NULL; END;
        RESET ROLE;
        UPDATE public.session_checklists SET is_active=false WHERE id=c.id;
        BEGIN
          PERFORM public.read_learning_evidence_v1(c.room_id,c.id,teacher);
          RAISE EXCEPTION 'INACTIVE_READ_ALLOWED';
        EXCEPTION WHEN insufficient_privilege THEN NULL; END;
        UPDATE public.session_checklists SET is_active=true WHERE id=c.id;
        UPDATE public.coverage_evidence SET analysis='updated fixture' WHERE id=evidence;
        IF (SELECT updated_at FROM public.checklist_items WHERE id=i) IS NOT DISTINCT FROM after_time THEN
          RAISE EXCEPTION 'UPDATE_INVALIDATION_MISSING'; END IF;
        SELECT updated_at INTO after_time FROM public.checklist_items WHERE id=i;
        UPDATE public.coverage_evidence SET item_id=other_item WHERE id=evidence;
        IF (SELECT updated_at FROM public.checklist_items WHERE id=i) IS NOT DISTINCT FROM after_time
          OR (SELECT updated_at FROM public.checklist_items WHERE id=other_item) IS NOT DISTINCT FROM other_time THEN
          RAISE EXCEPTION 'REASSIGNMENT_INVALIDATION_MISSING'; END IF;
        SELECT updated_at INTO other_time FROM public.checklist_items WHERE id=other_item;
        BEGIN
          UPDATE public.coverage_evidence SET analysis='rolled back' WHERE id=evidence;
          RAISE EXCEPTION 'ROLLBACK_PROBE';
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM <> 'ROLLBACK_PROBE' THEN RAISE; END IF;
        END;
        IF (SELECT updated_at FROM public.checklist_items WHERE id=other_item) IS DISTINCT FROM other_time THEN
          RAISE EXCEPTION 'INVALIDATION_ESCAPED_ROLLBACK'; END IF;
        UPDATE public.rooms SET guard_mode=true WHERE id=c.room_id;
        BEGIN
          UPDATE public.coverage_evidence SET analysis='guard forbidden' WHERE id=evidence;
          RAISE EXCEPTION 'GUARD_WRITE_ALLOWED';
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM NOT LIKE 'Learning progression is locked%' THEN RAISE; END IF;
        END;
        IF (SELECT updated_at FROM public.checklist_items WHERE id=other_item) IS DISTINCT FROM other_time THEN
          RAISE EXCEPTION 'GUARD_INVALIDATION_ESCAPED'; END IF;
        SELECT ci.id,ci.updated_at,sc.room_id INTO i,before_time,c.room_id
          FROM public.checklist_items ci JOIN public.session_checklists sc ON sc.id=ci.checklist_id
          WHERE sc.progress_policy_version='legacy_v1' AND NOT ci.deleted LIMIT 1;
        IF i IS NULL THEN RAISE EXCEPTION 'RESTORED_LEGACY_FIXTURE_REQUIRED'; END IF;
        UPDATE public.rooms SET guard_mode=false WHERE id=c.room_id;
        SET LOCAL ROLE anon;
        INSERT INTO public.coverage_evidence(item_id,evidence_text,analysis,confidence_score,detection_method)
          VALUES(i,'legacy fixture','legacy fixture',100,'tutor_manual');
        IF (SELECT updated_at FROM public.checklist_items WHERE id=i) IS NOT DISTINCT FROM before_time THEN
          RAISE EXCEPTION 'LEGACY_INVALIDATION_MISSING'; END IF;
        RESET ROLE;
      END;
      $test$;
      ROLLBACK;`));
    assert.equal(snapshot(), before, 'Evidence fixture transaction leaves no rows or progress changes');
  } else if (scenario === 'atomic') {
    ok(query('ALTER TABLE public.coverage_evidence RENAME TO coverage_evidence_unavailable;'));
    const failed = file(migration);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /LEARNING_REALTIME_TABLE_REQUIRED/);
    assert.equal(membership(), beforeMembers, 'Missing last table rolls back earlier membership additions');
    ok(query('ALTER TABLE public.coverage_evidence_unavailable RENAME TO coverage_evidence;'));
    assert.equal(snapshot(), before);
  } else throw new Error('Unknown scenario');
} else {
  test('learning progress publication against verified disposable hosted baseline', {
    skip: !process.env.PG_LEARNING_REALTIME_VERIFIED_BASELINE || !executor
  }, async t => {
    for (const scenario of ['red-green', 'atomic']) {
      await t.test(scenario, () => {
        const result = spawnSync(process.execPath, [path.join(__dirname, 'disposable-database.js'),
          '--template', process.env.PG_LEARNING_REALTIME_VERIFIED_BASELINE,
          '--', process.execPath, __filename, '--scenario', scenario], { encoding: 'utf8', env: process.env });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        process.stdout.write(result.stdout);
      });
    }
  });
}
