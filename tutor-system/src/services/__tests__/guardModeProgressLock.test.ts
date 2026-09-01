#!/usr/bin/env node
/** Purpose: protect the Guard Mode database contract against checklist deletion and completion bypasses. */

import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/023_guard_mode.sql');

describe('Guard Mode progress-lock migration contract', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');

  it('blocks hard and soft checklist-item deletion while Guard Mode is active', () => {
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON checklist_items/);
    expect(migration).toMatch(/NEW\.deleted IS NOT DISTINCT FROM OLD\.deleted/);
  });

  it('blocks direct checklist completion-field changes and deletes', () => {
    expect(migration).toMatch(/NEW\.total_items IS NOT DISTINCT FROM OLD\.total_items/);
    expect(migration).toMatch(/NEW\.completed_items IS NOT DISTINCT FROM OLD\.completed_items/);
    expect(migration).toMatch(/NEW\.completion_percentage IS NOT DISTINCT FROM OLD\.completion_percentage/);
    expect(migration).toMatch(/BEFORE UPDATE OR DELETE ON session_checklists/);
  });
});
