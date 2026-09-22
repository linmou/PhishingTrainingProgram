// Test responsibility: statically verify the forward-only server-authority migration boundary.

import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260922000000_transfer_assessment_server_authority.sql');

describe('server-authoritative transfer assessment migration', () => {
  it('exists as one atomic forward migration and does not reactivate archived files', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql.trimStart()).toMatch(/^--!\/usr\/bin\/env psql\n-- Purpose:/);
    expect(sql).toMatch(/\bBEGIN\s*;/i);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/i);
    expect(sql).not.toContain('archived_migrations/');
  });

  it('moves grading material and attempts into private storage', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? private\.transfer_assessments/i);
    expect(sql).toMatch(/learner_safe_explanation/i);
    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? private\.transfer_assessment_attempts/i);
    expect(sql).toMatch(/UNIQUE\s*\(assessment_id, ordinal\)/i);
    expect(sql).toMatch(/UNIQUE\s*\(answer_message_id\)/i);
    expect(sql).toMatch(/UNIQUE\s*\(request_id\)/i);
    expect(sql).toMatch(/attempt_count\s+BETWEEN\s+0\s+AND\s+2/i);
  });

  it('stores immutable target routing metadata and removes the public key', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS assessment_student_id UUID/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS assessment_key/i);
    expect(sql).toMatch(/assessment_student_id/i);
    expect(sql).toMatch(/v_assessment->>'stem'/i);
  });

  it('defines service-role-only versioned RPCs with expected-snapshot compare-and-swap', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    for (const name of [
      'send_reviewed_tutor_response_v4', 'post_assessment_message_v2',
      'get_transfer_assessment_processing_context_v1', 'process_assessment_message_v2',
      'record_transfer_provider_attempt_v1',
    ]) expect(sql).toContain(name);
    expect(sql).toMatch(/p_expected_attempt_count/i);
    expect(sql).toMatch(/p_expected_resolution/i);
    expect(sql).toMatch(/FOR UPDATE/i);
    expect(sql).toMatch(/CONCURRENT_MODIFICATION/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*?FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*?TO service_role/i);
  });

  it('keeps first-wrong separate from the terminal learning-event transaction', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/p_answer_outcome = 'retry'/i);
    expect(sql).toMatch(/p_answer_outcome IN \('passed', 'failed'\)/i);
    expect(sql).toMatch(/apply_learning_event_v1/i);
    expect(sql).toMatch(/terminal_failure_feedback/i);
  });
});
