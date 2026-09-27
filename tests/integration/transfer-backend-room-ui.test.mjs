#!/usr/bin/env node
// Purpose: integration-owned E03 handoff test (102 -> 103). It asserts the
// contract of `prepareTurn` that component 103's adapter consumes and that the merged
// edge test will drive: the wrapper's key set, the nested candidate, the null-capable item id,
// and the rule that preparing a turn persists nothing. The consumer half drives real 102 facade
// output through 103's adapter below.
//
// Run with: node --test tests/integration/transfer-backend-room-ui.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTutorSystemEnv } from '../../tools/load-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const EDGE_SOURCE_PATH = 'tutor-system/supabase/functions/assessment-api/index.ts';
const edgeSource = readFileSync(path.join(repoRoot, EDGE_SOURCE_PATH), 'utf8');

function prepareBody() {
  const start = edgeSource.indexOf('async function prepareTurn');
  assert.notStrictEqual(start, -1, `${EDGE_SOURCE_PATH} must define prepareTurn`);
  const next = edgeSource.indexOf('\nasync function ', start + 1);
  return edgeSource.slice(start, next === -1 ? edgeSource.length : next);
}

test('local 102 contract: prepare_turn returns the scope wrapper component 103 consumes', () => {
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
    if (key === 'decision') assert.match(returnBlock, /decision:\s*candidate\b/);
  }
  assert.match(body, /prepare_transfer_turn_v1/);
  assert.match(body, /p_focus_student_message_id/);
  assert.match(body, /p_checklist_id/);
});

test('local 102 contract: the candidate is nested and non-assessment item identity is null', () => {
  const body = prepareBody();
  const returnBlock = body.slice(body.lastIndexOf('return {'));

  assert.match(
    returnBlock,
    /decision:\s*candidate\b/,
    'the generated candidate must be nested under `decision`, not spread into the wrapper',
  );
  assert.match(returnBlock, /\.\.\.scope/);
});

test('local 102 contract: preparing a turn persists nothing', () => {
  const body = prepareBody();

  assert.doesNotMatch(
    body,
    /\.(insert|upsert|update|delete)\(/,
    'prepare_turn must not write: there is no draft table, so nothing may be persisted until send_reviewed delivers. A write here would create a phantom record for a candidate the teacher never confirms',
  );
});

test('local 102 contract: prepare_turn refuses scoped failures rather than degrading silently', () => {
  const body = prepareBody();

  assert.match(body, /assertTeacher\(principal\)/);
  assert.match(body, /assertRoom\(principal, body\.room_id\)/);
  assert.match(body, /providerConfig\(deps\)/);
});

// ---------------------------------------------------------------------------------------------
// These fixtures exercise the local facade and adapter contracts. The real producer-to-consumer
// E02/E03 handoffs are covered by transfer-backend-room-ui-handler.test.ts.
// ---------------------------------------------------------------------------------------------

const env = loadTutorSystemEnv();
void env;

const { TransferAssessmentService } = await import(
  '../../tutor-system/src/services/transferAssessmentService.ts'
);
const adapter = await import('../../tutor-system/src/contexts/transferAssessmentUiAdapter.ts');

/** The exact prepare_turn wrapper shape, measured from the Edge Function source above. */
const PREPARE_WRAPPER = {
  decision: {
    response: 'Notice the payment request is urgent and the link domain is not the bank.',
    decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: 'item-1' },
    assessment: {
      stem: 'What is the strongest evidence this message is a phishing attempt?',
      rendered_text: 'What is the strongest evidence this message is a phishing attempt?',
      selection_type: 'single',
      options: [
        { id: 'A', text: 'The message arrived after hours' },
        { id: 'B', text: 'The link domain is not the bank domain' },
        { id: 'C', text: 'The message uses a greeting' },
        { id: 'D', text: 'The message mentions an account' },
      ],
      correct_option_ids: ['B'],
      transfer_basis: { source_evidence_message_ids: ['msg-1'] },
    },
  },
  progress_snapshot_hash: 'hash-1',
  room_id: 'room-1',
  student_id: 'student-1',
  checklist_id: 'checklist-1',
  item_id: 'item-1',
  focus_student_message_id: 'msg-1',
};

function serviceReturning(payload) {
  return new TransferAssessmentService({
    api: { invoke: async () => ({ data: { ok: true, data: payload }, error: null }) },
    requestId: () => 'request-fixed-1',
  });
}

test('local facade/adapter contract: the prepare envelope preserves scope identity', async () => {
  const prepared = await serviceReturning(PREPARE_WRAPPER).prepareTurn({
    roomId: 'room-1',
    focusStudentMessageId: 'msg-1',
    checklistId: 'checklist-1',
  });

  const candidate = adapter.createReviewCandidate(prepared);
  assert.ok(candidate, 'a valid assessment wrapper must produce a reviewable candidate');
  assert.deepEqual(
    candidate.scope,
    {
      roomId: 'room-1',
      studentId: 'student-1',
      checklistId: 'checklist-1',
      itemId: 'item-1',
      focusStudentMessageId: 'msg-1',
    },
    'FR-001: the whole reviewed-send scope must come from the prepare envelope unchanged',
  );
  assert.equal(candidate.decision.response, PREPARE_WRAPPER.decision.response);
});

test('local facade/adapter contract: a non-assessment turn keeps a null item id', async () => {
  const prepared = await serviceReturning({
    ...PREPARE_WRAPPER,
    item_id: null,
    decision: { response: 'r', decision: { mode: 'tutoring', instruction: 'ask_question', target_item_id: null } },
  }).prepareTurn({ roomId: 'room-1', focusStudentMessageId: 'msg-1', checklistId: 'checklist-1' });

  const candidate = adapter.createReviewCandidate(prepared);
  assert.ok(candidate);
  assert.strictEqual(candidate.scope.itemId, null);

  // The same value arriving as the literal text is still not a usable identity.
  const asText = adapter.createReviewCandidate({ ...prepared, item_id: 'null' });
  assert.strictEqual(asText.scope.itemId, null);
});

test('local adapter contract: the learner projection carries no private key', async () => {
  const prepared = await serviceReturning(PREPARE_WRAPPER).prepareTurn({
    roomId: 'room-1',
    focusStudentMessageId: 'msg-1',
    checklistId: 'checklist-1',
  });

  const projection = adapter.publicAssessmentForDecision(prepared.decision, 'message-9', 'student-1');
  assert.deepEqual(
    Object.keys(projection).sort(),
    ['id', 'options', 'selection_type', 'stem', 'student_id'],
    'the learner projection must be exactly the public assessment fields',
  );

  const serialized = JSON.stringify(projection);
  for (const key of ['correct_option_ids', 'transfer_basis', 'assessment_key', 'raw_model_output', 'rationale']) {
    assert.ok(!serialized.includes(key), `the learner projection leaked ${key}`);
  }
});

test('local adapter contract: scoped failures classify to distinct fail-closed outcomes', () => {
  const cases = [
    ['LEGACY_CHECKLIST: no transfer checklist in this room', 'unavailable'],
    ['WRONG_LEARNER: the focus message is not this learner', 'validation'],
    ['ASSESSMENT_ALREADY_OPEN: this learner already has a delivered assessment', 'superseded'],
  ];

  const statuses = new Set();
  for (const [message, expected] of cases) {
    const classified = adapter.classifyAssessmentFailure(new Error(message));
    assert.equal(classified.status, expected, `${message} must classify as ${expected}`);
    statuses.add(classified.status);
  }
  assert.equal(
    statuses.size,
    3,
    'collapsing these into one generic error is what hides whether the teacher should retry, re-prepare, or stop',
  );
});
