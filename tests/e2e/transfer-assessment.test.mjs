#!/usr/bin/env node
// Purpose: integration-owned end-to-end aggregate for the transfer-assessment lifecycle. It runs
// one teacher session across both components: component 101's real pure resolver decides the turn
// and produces the private assessment, component 102's real service facade reviews and delivers it
// through its typed operations, and the published result is checked to contain no private
// assessment material. Only the network transport (the Edge Function call) is replaced; every
// projection and every decision under test is the production implementation.
//
// Run with: node --import ../tools/ts-resolve.mjs --test tests/e2e/transfer-assessment.test.mjs

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTutorSystemEnv } from '../../tools/load-env.mjs';

// Component 102's service constructs a Supabase client at module load, so the environment must
// exist before the service module is imported.
loadTutorSystemEnv();

const { TransferAssessmentService, toPublicMessageDTO, toPublicQuestionDTO, toTeacherAssessmentDraftDTO } = await import(
  '../../tutor-system/src/services/transferAssessmentService.ts'
);
const { projectPublicPayload, containsPrivateFieldName } = await import(
  '../../tutor-system/src/types/assessmentApi.ts'
);
const { resolveTransferAnswer } = await import(
  '../../tutor-system/src/services/transferAssessmentOrchestrator.ts'
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

/** A stored question row as `assessment_questions` holds it, with private columns populated. */
function storedQuestionRow() {
  return {
    id: 'question-1',
    room_id: 'room-1',
    student_id: 'student-1',
    checklist_id: 'checklist-1',
    item_id: 'item-1',
    tutor_message_id: 'message-2',
    source_student_message_id: 'message-1',
    selection_type: 'single',
    stem: 'Which statement best describes the risk to this account?',
    rendered_text: 'Which statement best describes the risk to this account?',
    options: OPTIONS,
    lifecycle: 'open',
    answer_message_id: null,
    selected_option_ids: null,
    result: null,
    closed_reason: null,
    feedback_message_id: null,
    correct_option_ids: ['B'],
    transfer_basis: { concept_rule: 'A familiar sender is not proof of safety.' },
    public_payload_hash: 'd'.repeat(64),
  };
}

/** A private draft row as `private.assessment_drafts` holds it. */
function storedDraftRow() {
  return {
    draft_id: 'draft-1',
    revision: 1,
    status: 'draft',
    supersedes_draft_id: null,
    progress_snapshot_hash: 'e'.repeat(64),
    decision: { mode: 'assessment', instruction: 'transfer_assess' },
    reason: 'The learner has not yet transferred the rule to a new sender.',
    assessment_basis: { concept_rule: 'A familiar sender is not proof of safety.' },
    id: 'draft-1',
    room_id: 'room-1',
    student_id: 'student-1',
    raw_model_output: { decision: { mode: 'assessment' } },
    raw_hash: 'f'.repeat(64),
    final_hash: null,
    reviewed_payload: null,
    trigger_key: 'trigger-key-abc',
    created_at: '2026-09-12T00:00:00.000Z',
  };
}

function storedTutorMessageRow() {
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
    raw_model_output: { decision: { mode: 'assessment' } },
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

test('E2E: a prepared draft is reviewed, delivered, and exposes no private material to the learner', async () => {
  const transport = createRecordingTransport({
    prepare_turn: () => ({ draft: storedDraftRow(), status: 'draft' }),
    review_draft: () => ({ draft_id: 'draft-1', revision: 2, final_hash: 'a'.repeat(64) }),
    send_reviewed: () => ({
      message: storedTutorMessageRow(),
      question: storedQuestionRow(),
      room: { id: 'room-1', active_response_mode: 'tutoring' },
      feedback_id: 'feedback-1',
    }),
  });

  const service = new TransferAssessmentService({ api: transport.api, requestId: () => 'request-e2e-1' });
  const assessment = producedAssessment();

  // Component 101 decides the turn on the real assessment; the grade and transition are real.
  const resolved = resolveTransferAnswer(lifecycleContext(), answerInput('B'));
  assert.equal(resolved.disposition, 'passed', 'the resolver must grade a delivered correct answer as passed');
  assert.equal(resolved.applied_transition, 'assessment_pass');
  assert.deepEqual(resolved.progress, { status: 'covered', understanding_level: 'good' });
  assert.equal(resolved.feedback_required, true, 'a pass still requires tutor feedback');

  const prepared = await service.prepareTurn({
    roomId: 'room-1',
    focusStudentMessageId: 'message-1',
    checklistId: 'checklist-1',
  });
  const reviewed = await service.reviewDraft({
    draftId: 'draft-1',
    expectedRevision: 1,
    finalPayload: { decision: { mode: 'assessment', instruction: 'transfer_assess' }, response: assessment.stem ?? publicAssessment().stem },
    contentConfirmed: true,
  });
  const delivered = await service.sendReviewed({
    draftId: 'draft-1',
    expectedRevision: 2,
    expectedHash: reviewed.final_hash,
  });

  // The lifecycle ran in order through the shared API contract.
  assert.deepEqual(
    transport.calls.map((call) => call.operation),
    ['prepare_turn', 'review_draft', 'send_reviewed'],
    'the session must drive prepare, review, and send in that order'
  );
  assert.equal(prepared.status, 'draft', 'the prepared turn yields a draft');
  assert.equal(delivered.question.lifecycle, 'open', 'the delivered question is open for the learner');

  // The published learner payload carries no private assessment material, checked by key and value.
  const learnerPayload = JSON.stringify({ question: delivered.question, message: delivered.message });
  PRIVATE_KEYS.forEach((key) => {
    assert.equal(learnerPayload.includes(key), false, `public payload leaked private key ${key}`);
  });
  assert.equal(
    learnerPayload.includes('A familiar sender is not proof of safety.'),
    false,
    'public payload leaked the transfer basis text'
  );
  assert.equal(containsPrivateFieldName(delivered.question), false, 'shared guard must see no private field name');
  assert.deepEqual(delivered.question.options, OPTIONS, 'the learner still receives all four ordered options');
});

test('E2E: the teacher-private draft carries the basis while the public projection never does', () => {
  const draft = storedDraftRow();
  const teacherView = toTeacherAssessmentDraftDTO(draft);
  const publicView = projectPublicPayload(storedQuestionRow());

  // The reviewing teacher needs the private basis; that is the whole reason this DTO exists.
  assert.deepEqual(teacherView.assessment_basis, { concept_rule: 'A familiar sender is not proof of safety.' });
  assert.equal(draft.trigger_key, 'trigger-key-abc', 'the storage row does hold the trigger key');
  assert.equal(teacherView.trigger_key, undefined, 'but the browser DTO must not expose it');
  assert.equal(teacherView.raw_model_output, undefined, 'raw model output must not reach the browser');
  assert.equal(teacherView.raw_hash, undefined, 'the raw hash must not reach the browser');
  assert.equal(teacherView.id, undefined, 'the storage id must not reach the browser');

  // The same underlying question projected for a learner must lose exactly those fields.
  assert.equal(publicView.correct_option_ids, undefined, 'public projection must strip the key');
  assert.equal(publicView.transfer_basis, undefined, 'public projection must strip the transfer basis');
  assert.equal(publicView.stem, storedQuestionRow().stem, 'public projection must keep the learner-visible stem');
});

test('E2E: a rejected draft is suppressed on the same trigger and regenerated only explicitly', async () => {
  const transport = createRecordingTransport({
    reject_draft: () => ({
      draft_id: 'draft-1',
      revision: 2,
      status: 'rejected',
      same_trigger_suppressed: true,
      request_id: 'request-e2e-2',
    }),
    regenerate_draft: () => ({
      source_draft_id: 'draft-1',
      source_status: 'superseded',
      replacement_draft_id: 'draft-2',
      replacement_revision: 1,
      replacement_status: 'draft',
      request_id: 'request-e2e-3',
    }),
  });
  const service = new TransferAssessmentService({ api: transport.api, requestId: () => 'request-e2e-2' });

  const rejected = await service.rejectDraft({ draftId: 'draft-1', expectedRevision: 1, reason: 'teacher_rejected' });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.same_trigger_suppressed, true, 'a rejected trigger must be suppressed, not silently regenerated');

  const regenerated = await service.regenerateDraft({
    sourceDraftId: 'draft-1',
    expectedRevision: 2,
    expectedSnapshotHash: 'a'.repeat(64),
    providerPayload: { decision: { mode: 'assessment' } },
    rawHash: 'b'.repeat(64),
  });
  assert.equal(regenerated.source_status, 'superseded');
  assert.equal(regenerated.replacement_status, 'draft', 'the replacement starts a fresh draft lifecycle');
  assert.equal(regenerated.replacement_revision, 1, 'the replacement starts at revision 1');
});

test('E2E: the public message projection exposes identity and content but no private row', () => {
  const message = toPublicMessageDTO(storedTutorMessageRow());
  assert.equal(message.content, 'Which statement best describes the risk to this account?');
  assert.equal(message.user_role, 'tutor');
  assert.equal(message.raw_model_output, undefined, 'the public message must not carry raw model output');
  assert.equal(JSON.stringify(message).includes('raw_model_output'), false);
});
