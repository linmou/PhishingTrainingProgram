#!/usr/bin/env node
// Purpose: verify component 101 lifecycle outcomes and component 102 public DTO projection locally. The handler-level 101-to-102 persistence handoff is covered in transfer-domain-backend-handler.test.ts.
//
// Run with: node --import ../tools/ts-resolve.mjs --test tests/integration/transfer-domain-backend.test.mjs

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTutorSystemEnv } from '../../tools/load-env.mjs';

// Component 102's service constructs a Supabase client at module load, so the
// environment must exist before the service is imported.
const env = loadTutorSystemEnv();

const { TransferAssessmentService } = await import(
  '../../tutor-system/src/services/transferAssessmentService.ts'
);

import { resolveTransferAnswer } from '../../tutor-system/src/services/transferAssessmentOrchestrator.ts';


const OPTIONS = [
  { id: 'A', text: 'A familiar account proves the link is safe' },
  { id: 'B', text: 'The account could have been compromised' },
  { id: 'C', text: 'Every prize message is necessarily a scam' },
  { id: 'D', text: 'Opening the link proves the sender identity' },
];

const SNAPSHOT = 'integration-snapshot-1';

const PRIVATE_FIELD_NAMES = [
  'correct_option_ids',
  'transfer_basis',
  'rationale',
  'raw_model_output',
  'api_operation',
  'transport',
];

const VALID_PROGRESS_PAIRS = [
  'pending:none',
  'partially_covered:basic',
  'needs_review:basic',
  'covered:good',
];

function publicAssessment() {
  return {
    id: 'assessment-1',
    student_id: 'student-1',
    selection_type: 'single',
    stem: 'A familiar teammate sends a prize link.',
    rendered_text: 'A familiar teammate sends a prize link.\nChoose one.',
    options: OPTIONS,
  };
}

function makeAssessment(overrides = {}) {
  return {
    id: 'assessment-1',
    item_id: 'item-1',
    selection_type: 'single',
    options: OPTIONS,
    correct_option_ids: ['B'],
    progress_snapshot_hash: SNAPSHOT,
    ...overrides,
  };
}

function makeContext(overrides = {}) {
  return {
    progress: { status: 'partially_covered', understanding_level: 'basic' },
    participation_mode: 'tutoring',
    progress_snapshot_hash: SNAPSHOT,
    feedback_required: false,
    eligible_assessment_item_ids: ['item-1'],
    unresolved_assessment: publicAssessment(),
    pending_repair_message_id: null,
    ...overrides,
  };
}

function makeAnswer(content, overrides = {}) {
  return {
    delivered: true,
    answer_message_id: 'answer-1',
    content,
    assessment: makeAssessment(),
    ...overrides,
  };
}

/**
 * Test-local summary of a 101 resolver result. This is not component 102 code
 * and does not exercise its Edge handler or persistence RPC.
 */
function summarizeForLocalAssertions(result) {
  return {
    graded: result.disposition === 'passed' || result.disposition === 'failed',
    write: result.applied_transition !== null,
    applied_transition: result.applied_transition,
    next_pair: result.progress,
    feedback_required: result.feedback_required,
    learner_projection: {
      disposition: result.disposition,
      next_action: result.next_action,
      assessment_id: result.assessment_id,
    },
  };
}

test('101 domain contract: a delivered correct answer is terminal and asks for tutor feedback', () => {
  const produced = resolveTransferAnswer(makeContext(), makeAnswer('B'));
  const persisted = summarizeForLocalAssertions(produced);

  assert.equal(produced.disposition, 'passed');
  assert.equal(produced.applied_transition, 'assessment_pass');
  assert.deepEqual(produced.progress, { status: 'covered', understanding_level: 'good' });
  assert.equal(produced.feedback_required, true);
  assert.equal(persisted.graded, true);
  assert.equal(persisted.write, true);
  assert.equal(persisted.applied_transition, 'assessment_pass');
});

test('101 domain contract: a delivered wrong answer forces review and repair', () => {
  const produced = resolveTransferAnswer(makeContext(), makeAnswer('A'));
  const persisted = summarizeForLocalAssertions(produced);

  assert.equal(produced.disposition, 'failed');
  assert.equal(produced.applied_transition, 'assessment_fail');
  assert.deepEqual(produced.progress, { status: 'needs_review', understanding_level: 'basic' });
  assert.equal(produced.next_action, 'await_tutor_repair');
  assert.equal(persisted.write, true);
});

test('101 domain contract: undelivered, stale, Guard, feedback-pending, and no-open-assessment answers do not transition', () => {
  const cases = [
    ['undelivered', makeContext(), makeAnswer('B', { delivered: false })],
    ['stale', makeContext(), makeAnswer('B', { assessment: makeAssessment({ progress_snapshot_hash: 'other' }) })],
    ['guard', makeContext({ participation_mode: 'guard' }), makeAnswer('B')],
    ['feedback pending', makeContext({ feedback_required: true }), makeAnswer('B')],
    ['no open assessment', makeContext({ unresolved_assessment: null }), makeAnswer('B', { assessment: null })],
  ];

  for (const [label, turnContext, turnAnswer] of cases) {
    const produced = resolveTransferAnswer(turnContext, turnAnswer);
    const persisted = summarizeForLocalAssertions(produced);

    assert.equal(persisted.write, false, `${label} must not write`);
    assert.equal(produced.applied_transition, null, `${label} must not apply a transition`);
    assert.ok(
      VALID_PROGRESS_PAIRS.includes(`${produced.progress.status}:${produced.progress.understanding_level}`),
      `${label} must keep the closed progress vocabulary`
    );
  }
});

test('101 domain contract: private field names are absent from the resolver result', () => {
  const produced = resolveTransferAnswer(makeContext(), makeAnswer('B'));
  const serialized = JSON.stringify(produced);

  for (const field of PRIVATE_FIELD_NAMES) {
    assert.equal(Object.prototype.hasOwnProperty.call(produced, field), false, `${field} on result`);
    assert.equal(serialized.includes(field), false, `${field} in serialization`);
  }
  for (const key of Object.keys(summarizeForLocalAssertions(produced).learner_projection)) {
    assert.equal(PRIVATE_FIELD_NAMES.includes(key), false, `${key} in learner projection`);
  }
});

test('101 domain contract: replayed answers never produce a second transition', () => {
  const first = resolveTransferAnswer(makeContext(), makeAnswer('B'));
  const replayed = resolveTransferAnswer(
    makeContext({ progress: first.progress, feedback_required: first.feedback_required }),
    makeAnswer('B', { answer_message_id: 'answer-1' })
  );

  assert.equal(replayed.disposition, 'duplicate');
  assert.equal(replayed.applied_transition, null);
  assert.deepEqual(replayed.progress, first.progress);
});

test('101 domain contract: a repair-pending answer without new evidence does not transition', () => {
  const produced = resolveTransferAnswer(
    makeContext({
      progress: { status: 'needs_review', understanding_level: 'basic' },
      pending_repair_message_id: 'repair-1',
    }),
    makeAnswer('B', { answer_message_id: 'answer-2' })
  );

  assert.equal(produced.disposition, 'unresolved');
  assert.equal(produced.next_action, 'await_learner_evidence');
  assert.equal(produced.applied_transition, null);
});

test('102 public DTO projection: the assessment excludes the private key and basis', () => {
  // The private assessment component 101 hands over still carries the answer key
  // and transfer basis, so the edge must prove that 102 strips them.
  const privateAssessment = {
    id: 'assessment-1',
    student_id: 'student-1',
    selection_type: 'single',
    stem: 'A familiar teammate sends a prize link.',
    rendered_text: 'A familiar teammate sends a prize link.\nChoose one.',
    options: OPTIONS,
    correct_option_ids: ['B'],
    transfer_basis: {
      concept_rule: 'Displayed identity is not independent authentication.',
      source_context: 'The original account-alert example.',
      changed_context: 'A prize link from a known teammate account.',
      source_evidence_message_ids: ['22222222-2222-4222-8222-222222222222'],
    },
  };

  const projected = TransferAssessmentService.toPublicAssessment(privateAssessment);
  const serialized = JSON.stringify(projected);

  assert.equal(projected.id, 'assessment-1');
  assert.equal(projected.selection_type, 'single');
  assert.equal(projected.options.length, 4);
  assert.deepEqual(Object.keys(projected).sort(), [
    'id',
    'options',
    'selection_type',
    'stem',
    'student_id',
  ]);
  for (const field of ['correct_option_ids', 'transfer_basis', 'concept_rule', 'changed_context']) {
    assert.equal(serialized.includes(field), false, `${field} leaked through 102's projection`);
  }
});
