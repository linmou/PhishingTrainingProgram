#!/usr/bin/env node
/**
 * Test responsible for the hosted Supabase transfer-assessment migration's transactional, authorization, and live-schema compatibility guarantees.
 */

import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/025_transfer_assessment_storage.sql'),
  'utf8'
);
const messageRepresentationMigration = path.resolve(
  process.cwd(),
  'supabase/migrations/046_refactor_message_representation.sql'
);

describe('transfer assessment hosted migration', () => {
  it('adds the message-level Multi-agent mode and removes the legacy AI boolean/index', () => {
    expect(fs.existsSync(messageRepresentationMigration)).toBe(true);
    const migrationText = fs.readFileSync(messageRepresentationMigration, 'utf8');
    expect(migrationText).toMatch(/ALTER TYPE tutor_turn_mode ADD VALUE IF NOT EXISTS 'multiagent'/);
    expect(migrationText).toMatch(/DROP INDEX IF EXISTS idx_messages_is_ai_generated/);
    expect(migrationText).toMatch(/DROP COLUMN IF EXISTS is_ai_generated/);
  });

  it('recreates current message-writing RPCs explicitly without rewriting stored function text', () => {
    const migrationText = fs.readFileSync(messageRepresentationMigration, 'utf8');

    expect(migrationText).toMatch(/CREATE OR REPLACE FUNCTION public\.post_assessment_message_v1\(/i);
    expect(migrationText).toMatch(/CREATE OR REPLACE FUNCTION public\.send_reviewed_tutor_response_v3\(/i);
    expect(migrationText).not.toMatch(/pg_proc|pg_get_functiondef|regexp_replace/i);
  });
  it('is atomic and restores the transfer state required by assessment failures', () => {
    expect(migration.trimStart()).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS checklist_items_status_check/i);
    expect(migration).toMatch(/status IN \([\s\S]*?'pending'[\s\S]*?'partially_covered'[\s\S]*?'covered'[\s\S]*?'needs_review'/i);
  });

  it('removes the actual permissive hosted policies before applying scoped access rules', () => {
    for (const tableName of [
      'session_checklists',
      'checklist_items',
      'coverage_evidence',
      'checklist_updates'
    ]) {
      expect(migration).toContain(`DROP POLICY IF EXISTS "Allow all operations on ${tableName}" ON ${tableName};`);
    }
  });

  it('keeps the reviewed-send RPC compatible with the app simplified-auth client', () => {
    expect(migration).toMatch(/DROP FUNCTION IF EXISTS send_reviewed_tutor_response\([\s\S]*?tutor_response_mode, TEXT, tutor_response_mode, TEXT, TEXT, INTEGER, JSONB\s*\);/);
    expect(migration).toMatch(/DROP FUNCTION IF EXISTS send_reviewed_tutor_response\([\s\S]*?tutor_response_mode, TEXT, TEXT, tutor_response_mode, TEXT, TEXT, INTEGER, JSONB\s*\);/);
    expect(migration).toMatch(/CREATE FUNCTION send_reviewed_tutor_response\([\s\S]*?p_raw_instruction TEXT/);
    const reviewedSendSection = migration.slice(migration.lastIndexOf('CREATE FUNCTION send_reviewed_tutor_response('));
    expect(reviewedSendSection).not.toMatch(/p_tutor_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(reviewedSendSection).toMatch(/GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response\([\s\S]*?\) TO anon, authenticated;/);
  });

  it('rejects unknown progress events and requires source evidence from the learner in the same room', () => {
    expect(migration).toMatch(/v_kind NOT IN \([\s\S]*?'initial_signal'[\s\S]*?'assessment_fail'[\s\S]*?'contradiction'/);
    expect(migration).toMatch(/UNKNOWN_EVENT_KIND/);
    expect(migration).toMatch(/jsonb_array_elements_text\(p_event->'source_evidence_message_ids'\)/);
    expect(migration).toMatch(/m\.room_id = v_room\.id/);
    expect(migration).toMatch(/m\.user_id = v_student_id/);
    expect(migration).toMatch(/m\.user_role = 'student'/);
  });

  it('grades only an explicitly tagged assessment answer from the question room', () => {
    expect(migration).toMatch(/IF v_message\.assessment_id IS NULL THEN\s+RAISE EXCEPTION 'ASSESSMENT_NOT_OPEN'/);
    expect(migration).toMatch(/q\.id = v_message\.assessment_id\s+AND q\.room_id = v_message\.room_id/);
    expect(migration).not.toMatch(/v_message\.assessment_id IS NULL AND q\.room_id = v_message\.room_id/);
  });
});
