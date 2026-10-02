#!/usr/bin/env node
// Purpose: check the assessment-only 102 facade output consumed by the 103 room adapter.
//
// Run with: node --test tests/integration/transfer-backend-room-ui.test.mjs

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTutorSystemEnv } from '../../tools/load-env.mjs';

const env = loadTutorSystemEnv();
void env;

const { TransferAssessmentService } = await import(
  '../../tutor-system/src/services/transferAssessmentService.ts'
);
const adapter = await import('../../tutor-system/src/contexts/transferAssessmentUiAdapter.ts');

/** The exact prepare_turn wrapper shape, measured from the Edge Function source above. */
const PREPARE_WRAPPER = {
  assessment_draft: {
    reason: 'The learner has not yet applied independent verification to a bank alert.',
    target_item_id: 'item-1',
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
      learner_safe_explanation: 'Check the bank domain through a trusted channel.',
      transfer_basis: {
        concept_rule: 'Verify unexpected requests independently.',
        source_context: 'A familiar sender name made the message seem safe.',
        changed_context: 'A bank alert links to an unfamiliar domain.',
        source_evidence_message_ids: ['msg-1'],
      },
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
  const prepared = await serviceReturning(PREPARE_WRAPPER).prepareAssessment({
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
  assert.equal(candidate.decision.assessment.stem, PREPARE_WRAPPER.assessment_draft.assessment.stem);
});

test('local facade/adapter contract: a review candidate requires a target item id', async () => {
  const prepared = await serviceReturning({
    ...PREPARE_WRAPPER,
    item_id: null,
  }).prepareAssessment({ roomId: 'room-1', focusStudentMessageId: 'msg-1', checklistId: 'checklist-1' });

  const candidate = adapter.createReviewCandidate(prepared);
  assert.strictEqual(candidate, null);

  // The same value arriving as the literal text is still not a usable identity.
  const asText = adapter.createReviewCandidate({ ...prepared, item_id: 'null' });
  assert.strictEqual(asText, null);
});

test('local adapter contract: the learner projection carries no private key', async () => {
  const prepared = await serviceReturning(PREPARE_WRAPPER).prepareAssessment({
    roomId: 'room-1',
    focusStudentMessageId: 'msg-1',
    checklistId: 'checklist-1',
  });

  const projection = adapter.publicAssessmentForDecision(prepared.assessment_draft, 'message-9', 'student-1');
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
    ['WRONG_LEARNER: the focus message is not this learner', 'superseded'],
    ['ITEM_VALIDATION_FAILED: the candidate needs correction', 'validation'],
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
