#!/usr/bin/env node
// Purpose: local integration aggregate for the transfer-assessment lifecycle. It runs
// one teacher session across both components: component 101's real pure resolver decides the turn
// and produces the private assessment, component 102's real service facade prepares and delivers it
// through its typed operations, and the published result is checked to contain no private
// assessment material. The transport is replaced; the Deno handler test covers server validation.
//
// Run with: node --experimental-strip-types --import ./tools/ts-resolve.mjs --test tests/integration/transfer-assessment-service.test.mjs

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTutorSystemEnv } from '../../tools/load-env.mjs';

// Component 102's service constructs a Supabase client at module load, so the environment must
// exist before the service module is imported.
loadTutorSystemEnv();

const { TransferAssessmentService, toPublicMessageDTO } = await import(
  '../../tutor-system/src/services/transferAssessmentService.ts'
);
const { containsPrivateFieldName } = await import(
  '../../tutor-system/src/types/assessmentApi.ts'
);
const { resolveTransferAnswer } = await import(
  '../../tutor-system/src/services/transferAssessmentOrchestrator.ts'
);
const { validateAssessmentDraft } = await import(
  '../../tutor-system/src/services/assessmentValidation.ts'
);

const OPTIONS = [
  { id: 'A', text: 'A familiar account proves the link is safe' },
  { id: 'B', text: 'The account could have been compromised' },
  { id: 'C', text: 'Every prize message is necessarily a scam' },
  { id: 'D', text: 'Opening the link proves the sender identity' },
];

const SNAPSHOT = 'e2e-snapshot-1';

/** Private material that must never survive into a learner-visible payload. */
const PRIVATE_KEYS = ['correct_option_ids', 'transfer_basis', 'raw_model_output', 'reviewed_payload'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * A transport that records every operation it is asked to perform and replies with the exact
 * return shape the deployed versioned RPC produces. This is the boundary of the test: the facade,
 * the projections, and component 101's resolver are all real.
 */
function createRecordingTransport(responses) {
  const calls = [];
  return {
    calls,
    api: {
      invoke: async (body) => {
        calls.push(clone(body));
        const responder = responses[body.operation];
        if (!responder) {
          return { data: { ok: false, error: { code: 'UNSUPPORTED', message: 'no responder', retryable: false } }, error: null };
        }
        return { data: { ok: true, data: responder(body) }, error: null };
      },
    },
  };
}

/**
 * The API's delivered tutor message, with participant-readable message fields and a public
 * assessment projection. The key and transfer basis live in `private.transfer_assessments`.
 */
function deliveredMessageRow() {
  return {
    id: 'message-2',
    room_id: 'room-1',
    user_id: 'tutor-1',
    content: 'Which statement best describes the risk to this account?',
    user_role: 'tutor',
    is_ai_generated: true,
    parent_message_id: 'message-1',
    response_mode: 'assessment',
    created_at: '2026-09-12T00:00:01.000Z',
    assessment_options: clone(OPTIONS),
    assessment_selection_type: 'single',
    assessment_student_id: 'student-1',
    assessment_lifecycle: 'delivered',
    assessment_checklist_id: 'checklist-1',
    assessment_item_id: 'item-1',
    assessment: {
      id: 'assessment-1',
      student_id: 'student-1',
      selection_type: 'single',
      stem: 'Which statement best describes the risk to this account?',
      options: clone(OPTIONS),
    },
  };
}

/** Unexpected private fields in a malformed API response, for the browser projection check. */
function messageWithPrivateMaterial() {
  return {
    ...deliveredMessageRow(),
    assessment_key: ['B'],
    assessment_transfer_basis: { concept_rule: 'A familiar sender is not proof of safety.' },
    raw_model_output: { decision: { mode: 'assessment' } },
  };
}

/** The assessment-only draft the tutor confirms. */
function reviewedPayload() {
  return {
    reason: 'The learner has not yet transferred the rule to a new sender.',
    target_item_id: 'item-1',
    assessment: {
      selection_type: 'single',
      options: clone(OPTIONS),
      stem: 'Which statement best describes the risk to this account?',
      rendered_text: 'Which statement best describes the risk to this account?',
      correct_option_ids: ['B'],
      learner_safe_explanation: 'Verify the alert through the official app.',
      transfer_basis: {
        concept_rule: 'A familiar sender is not proof of safety.',
        source_context: 'The learner judged a link safe because the sender was familiar.',
        changed_context: 'A bank alert asks the learner to confirm a password after a transfer.',
        source_evidence_message_ids: ['message-1'],
      },
    },
  };
}

/** Component 101's private assessment, as its resolver consumes and emits it. */
function producedAssessment() {
  return {
    id: 'assessment-1',
    item_id: 'item-1',
    selection_type: 'single',
    options: clone(OPTIONS),
    correct_option_ids: ['B'],
    learner_safe_explanation: 'Verify the alert through the official app.',
    progress_snapshot_hash: SNAPSHOT,
  };
}

/** The learner-visible view of an open assessment, which carries no transfer basis. */
function publicAssessment() {
  return {
    id: 'assessment-1',
    item_id: 'item-1',
    selection_type: 'single',
    stem: 'Which statement best describes the risk to this account?',
    rendered_text: 'Which statement best describes the risk to this account?',
    options: clone(OPTIONS),
  };
}

function lifecycleContext(overrides = {}) {
  return {
    progress: { status: 'partially_covered', understanding_level: 'basic' },
    participation_mode: 'tutoring',
    progress_snapshot_hash: SNAPSHOT,
    feedback_required: false,
    eligible_assessment_item_ids: ['item-1'],
    unresolved_assessment: publicAssessment(),
    pending_repair_message_id: null,
    attempt_snapshot: {
      assessment_id: 'assessment-1',
      accepted_attempt_count: 0,
      resolution: 'open',
      processed_answer_message_ids: [],
    },
    ...overrides,
  };
}

function answerInput(content, overrides = {}) {
  return {
    delivered: true,
    answer_message_id: 'answer-1',
    content,
    assessment: producedAssessment(),
    ...overrides,
  };
}

test('integration: prepare returns a reviewable candidate and send_reviewed delivers it without the key', async () => {
  assert.deepEqual(Object.keys(reviewedPayload()).sort(), ['assessment', 'reason', 'target_item_id']);
  validateAssessmentDraft(reviewedPayload(), {
    knownItemIds: ['item-1'],
    knownMessageIds: ['message-1'],
  });
  // There is no draft table, so prepare_turn persists nothing and returns the candidate plus the
  // scope it applies to. The reviewed payload then travels on the single send_reviewed call.
  const transport = createRecordingTransport({
    prepare_turn: () => ({
      assessment_draft: reviewedPayload(),
      progress_snapshot_hash: SNAPSHOT,
      room_id: 'room-1',
      student_id: 'student-1',
      checklist_id: 'checklist-1',
      item_id: 'item-1',
      focus_student_message_id: 'message-1',
    }),
    send_reviewed: () => ({
      message: deliveredMessageRow(),
      room: { id: 'room-1', active_response_mode: 'tutoring' },
    }),
  });

  const service = new TransferAssessmentService({ api: transport.api, requestId: () => 'request-e2e-1' });

  // Component 101 decides the turn on the real assessment; the grade and transition are real.
  const resolved = resolveTransferAnswer(lifecycleContext(), answerInput('B'));
  assert.equal(resolved.disposition, 'passed', 'the resolver must grade a delivered correct answer as passed');
  assert.equal(resolved.applied_transition, 'assessment_pass');
  assert.deepEqual(resolved.progress, { status: 'covered', understanding_level: 'good' });
  assert.equal(resolved.feedback_required, true, 'a pass still requires tutor feedback');

  const prepared = await service.prepareAssessment({
    roomId: 'room-1',
    focusStudentMessageId: 'message-1',
    checklistId: 'checklist-1',
  });
  // Nothing is stored by prepare: the response carries the candidate and the scope, not a draft row.
  assert.equal(prepared.draft_id, undefined, 'prepare must not return a persisted draft');
  assert.equal(prepared.room_id, 'room-1', 'prepare returns the scope send_reviewed needs');
  assert.equal(prepared.item_id, 'item-1', 'prepare names the item the assessment targets');
  assert.deepEqual(prepared.assessment_draft, reviewedPayload());

  const delivered = await service.sendReviewed({
    reviewedPayload: reviewedPayload(),
    roomId: String(prepared.room_id),
    studentId: String(prepared.student_id),
    checklistId: String(prepared.checklist_id),
    itemId: prepared.item_id == null ? null : String(prepared.item_id),
    focusStudentMessageId: String(prepared.focus_student_message_id),
  });

  // The session drives prepare then send; the separate review step no longer exists.
  assert.deepEqual(
    transport.calls.map((call) => call.operation),
    ['prepare_turn', 'send_reviewed'],
    'the session must drive prepare and send, with no review round trip'
  );
  assert.equal(transport.calls[1].reviewed_payload.target_item_id, 'item-1');

  // The published learner payload carries no private assessment material, checked by key and value.
  const learnerPayload = JSON.stringify(delivered.message);
  PRIVATE_KEYS.forEach((key) => {
    assert.equal(learnerPayload.includes(key), false, `public payload leaked private key ${key}`);
  });
  assert.equal(
    learnerPayload.includes('A familiar sender is not proof of safety.'),
    false,
    'public payload leaked the transfer basis text'
  );
  assert.equal(containsPrivateFieldName(delivered.message), false, 'shared guard must see no private field name');
});

test('integration: the facade projection drops unexpected private fields in an API response', async () => {
  const injected = messageWithPrivateMaterial();
  assert.deepEqual(injected.assessment_key, ['B'], 'the injected response carries the key');
  assert.deepEqual(injected.assessment_options, OPTIONS, 'and the ordered options');

  const transport = createRecordingTransport({
    send_reviewed: () => ({
      message: injected,
      room: { id: 'room-1', active_response_mode: 'tutoring' },
    }),
  });
  const service = new TransferAssessmentService({ api: transport.api, requestId: () => 'request-e2e-2' });

  const delivered = await service.sendReviewed({
    reviewedPayload: reviewedPayload(),
    roomId: 'room-1',
    studentId: 'student-1',
    checklistId: 'checklist-1',
    itemId: 'item-1',
    focusStudentMessageId: 'message-1',
  });

  // The facade allowlist also protects against an unexpectedly broad API response.
  assert.equal(delivered.message.assessment_key, undefined, 'the response must not carry the key');
  assert.equal(
    JSON.stringify(delivered.message).includes('assessment_key'),
    false,
    'the key name must not appear anywhere in the delivered response'
  );
  assert.equal(
    JSON.stringify(delivered.message).includes('correct_option_ids'),
    false,
    'the private key field must not appear under its model name either'
  );
  assert.equal(containsPrivateFieldName(delivered.message), false, 'shared guard must see no private field name');

  // The same projection of the injected row keeps the learner-visible identity.
  const publicView = toPublicMessageDTO(injected);
  assert.equal(publicView.id, 'message-2');
  assert.equal(publicView.user_role, 'tutor');
  assert.equal(publicView.assessment_key, undefined, 'public projection must strip the key');
});

test('integration: the public message projection exposes identity and content but no private row', () => {
  const stored = deliveredMessageRow();
  assert.equal(stored.assessment_key, undefined, 'the public response must not carry the answer key');
  assert.equal(stored.assessment_transfer_basis, undefined, 'the public response must not carry the transfer basis');
  const message = toPublicMessageDTO(stored);
  assert.equal(message.content, 'Which statement best describes the risk to this account?');
  assert.equal(message.user_role, 'tutor');
  assert.equal(message.response_mode, 'assessment');
  assert.equal(message.raw_model_output, undefined, 'the public message must not carry raw model output');
  assert.equal(JSON.stringify(message).includes('raw_model_output'), false);
});
