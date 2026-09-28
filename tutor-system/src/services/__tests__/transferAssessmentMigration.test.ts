// Test responsibility: verify the private-storage migration's guarded test-data cleanup and access boundary.

import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(process.cwd(), 'supabase/archived_migrations/20260928000000_private_transfer_assessment_storage.sql');
const migration = () => fs.readFileSync(migrationPath, 'utf8');

describe('private transfer assessment storage migration', () => {
  it('exists as one atomic forward migration', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = migration();
    expect(sql.trimStart()).toMatch(/^--!\/usr\/bin\/env psql\n-- Purpose:/);
    expect(sql).toMatch(/\bBEGIN\s*;/i);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/i);
  });

  it('creates the private grading table with explicit role boundaries', () => {
    const sql = migration();
    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? private\.transfer_assessments/i);
    expect(sql).toMatch(/question_message_id\s+UUID\s+NOT NULL\s+UNIQUE/i);
    expect(sql).toMatch(/correct_option_ids\s+TEXT\[\]/i);
    expect(sql).toMatch(/learner_safe_explanation/i);
    expect(sql).toMatch(/'legacy_incomplete'/i);
    expect(sql).toMatch(/ALTER TABLE private\.transfer_assessments ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE private\.transfer_assessments FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private\.transfer_assessments TO service_role/i);
  });

  it('adds the public target-routing field without exposing private assessment fields', () => {
    const sql = migration();
    expect(sql).toMatch(/ADD COLUMN assessment_student_id UUID/i);
    expect(sql).not.toMatch(/ADD COLUMN[^;]*assessment_key/i);
  });

  it('deletes only the two approved test messages after exact state and dependency checks', () => {
    const sql = migration();
    const guard = sql.indexOf('ASSESSMENT_TEST_FIXTURES_CHANGED');
    const removeFeedback = sql.indexOf('DELETE FROM public.message_feedback');
    const removeMessages = sql.indexOf('DELETE FROM public.messages');
    const dropKey = sql.indexOf('DROP COLUMN assessment_key');
    expect(guard).toBeGreaterThan(0);
    expect(removeFeedback).toBeGreaterThan(guard);
    expect(removeMessages).toBeGreaterThan(removeFeedback);
    expect(dropKey).toBeGreaterThan(removeMessages);
    expect(sql).toContain('3c931640-62e9-4b83-8a5a-d90683a89d23');
    expect(sql).toContain('a4d0148e-a9d0-471a-9ea7-87a6fceb39e1');
    expect(sql).toContain('beaad782-777a-45cc-a8cb-a0966215469e');
    expect(sql).toContain('b94387eb-c733-4eb0-bc5a-378a40a8de9f');
    const preflight = sql.slice(0, guard);
    expect(preflight).toMatch(/assessment_lifecycle\s*=\s*'delivered'/i);
    expect(preflight).toMatch(/assessment_selection_type\s*=\s*'single'/i);
    expect(preflight).toMatch(/cardinality\(m\.assessment_key\)\s*=\s*1/i);
    expect(preflight).toMatch(/parent_message_id/i);
    expect(preflight).toMatch(/ai_suggestion_feedback/i);
    expect(preflight).toMatch(/learning_event_inbox/i);
    expect(preflight).toMatch(/assessment_answer_message_id/i);
    expect(preflight).toMatch(/message_feedback/i);
  });

  it('disables old RPCs that require the public key column', () => {
    const sql = migration();
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.process_assessment_message_v1\(uuid, uuid, uuid\) FROM PUBLIC, anon, authenticated, service_role/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.send_reviewed_tutor_response_v3\(jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid\) FROM PUBLIC, anon, authenticated, service_role/i);
  });
});
