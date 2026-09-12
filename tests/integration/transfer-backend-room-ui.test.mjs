#!/usr/bin/env node
// Purpose: integration-owned E03 handoff test (102 -> 103), PRODUCTION side. It asserts the
// contract of `prepareTransferTurn` that component 103's adapter consumes and that the merged
// edge test will drive: the wrapper's key set, the nested candidate, the null-capable item id,
// and the rule that preparing a turn persists nothing. The CONSUMER half - driving real 102
// facade output through 103's adapter - is added when 103 is merged into integration; until then
// this file covers the production side only and says so rather than implying full E03 coverage.
//
// Run with: node --test tests/integration/transfer-backend-room-ui.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const EDGE_SOURCE_PATH = 'tutor-system/supabase/functions/assessment-api/index.ts';
const edgeSource = readFileSync(path.join(repoRoot, EDGE_SOURCE_PATH), 'utf8');

function prepareBody() {
  const start = edgeSource.indexOf('async function prepareTransferTurn');
  assert.notStrictEqual(start, -1, `${EDGE_SOURCE_PATH} must define prepareTransferTurn`);
  const next = edgeSource.indexOf('\nasync function ', start + 1);
  return edgeSource.slice(start, next === -1 ? edgeSource.length : next);
}

test('E03: prepare_turn returns the scope wrapper component 103 consumes, not a bare decision', () => {
  const body = prepareBody();
  const returnBlock = body.slice(body.lastIndexOf('return {'));

  for (const key of [
    'decision',
    'progress_snapshot_hash',
    'room_id',
    'student_id',
    'checklist_id',
    'item_id',
    'focus_student_message_id',
  ]) {
    assert.match(
      returnBlock,
      new RegExp(`\\b${key}\\s*:`),
      `the prepare_turn wrapper must carry \`${key}\`; 103's adapter reads all five scope fields from it to preserve focus identity`,
    );
  }
});

test('E03: the candidate is nested under decision, and the item id is null for a non-assessment turn', () => {
  const body = prepareBody();
  const returnBlock = body.slice(body.lastIndexOf('return {'));

  assert.match(
    returnBlock,
    /decision:\s*candidate\b/,
    'the generated candidate must be nested under `decision`, not spread into the wrapper',
  );
  assert.match(
    returnBlock,
    /item_id:\s*candidate\.decision\.target_item_id\b/,
    'item_id must be the candidate target, which is null for a tutoring or Guard turn; hardcoding a string here is what produces the "null" UUID defect',
  );
});

test('E03: preparing a turn persists nothing', () => {
  const body = prepareBody();

  assert.doesNotMatch(
    body,
    /\.(insert|upsert|update|delete)\(/,
    'prepare_turn must not write: there is no draft table, so nothing may be persisted until send_reviewed delivers. A write here would create a phantom record for a candidate the teacher never confirms',
  );
});

test('E03: prepare_turn refuses the three scoped failure states rather than degrading silently', () => {
  const body = prepareBody();

  for (const code of ['LEGACY_CHECKLIST', 'WRONG_LEARNER', 'ASSESSMENT_ALREADY_OPEN']) {
    assert.ok(
      body.includes(code),
      `prepare_turn must still fail closed with ${code}; it is the surviving server-side guard now that the draft revision check was withdrawn`,
    );
  }
});
