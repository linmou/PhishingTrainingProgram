#!/usr/bin/env node
/**
 * Test responsible for 024_raw_instruction.sql replacing the reviewed-response RPC and enforcing raw-instruction audit constraints without backfilling history.
 */

import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/024_raw_instruction.sql'),
  'utf8'
);

describe('raw instruction migration', () => {
  it('drops the old RPC signature and creates the new signature with raw instruction', () => {
    expect(migration).toMatch(/DROP FUNCTION IF EXISTS send_reviewed_tutor_response\([\s\S]*?INTEGER, JSONB\s*\);/);
    expect(migration).toMatch(/CREATE FUNCTION send_reviewed_tutor_response\([\s\S]*?p_raw_mode tutor_response_mode,\s*p_raw_instruction TEXT,\s*p_mode_reason TEXT/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response\([\s\S]*?tutor_response_mode, TEXT, TEXT, tutor_response_mode/);
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION send_reviewed_tutor_response/);
  });

  it('allows only canonical instructions and null only for new Guard rows', () => {
    for (const instruction of [
      'protective_instruction',
      'correction',
      'scaffolding',
      'explanation',
      'consolidation'
    ]) {
      expect(migration).toContain(`'${instruction}'`);
    }
    expect(migration).toMatch(/raw_mode IS NOT NULL/);
    expect(migration).toMatch(/raw_instruction IS NOT NULL OR raw_mode = 'guard'/);
    expect(migration).toMatch(/p_raw_mode IS NULL/);
    expect(migration).toMatch(/p_raw_mode = 'tutoring' AND p_raw_instruction IS NULL/);
    expect(migration).not.toMatch(/p_raw_mode = 'guard' AND p_raw_instruction IS NOT NULL/);
    expect(migration).toMatch(/ai_suggestion_feedback_raw_instruction_mode_check[\s\S]*?NOT VALID/);
  });

  it('stores the parameter and leaves historical rows untouched', () => {
    expect(migration).toMatch(/raw_mode, raw_instruction, mode_reason/);
    expect(migration).toMatch(/p_raw_mode, p_raw_instruction, btrim\(p_mode_reason\)/);
    expect(migration).not.toMatch(/UPDATE\s+ai_suggestion_feedback/i);
  });
});
