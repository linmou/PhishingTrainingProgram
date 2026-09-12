#!/usr/bin/env node
/**
 * Contract tests for the mode/instruction/target rules in transferAssessmentUiAdapter.ts.
 *
 * Responsibility: prove the React boundary rejects an incompatible reviewed payload, keeps
 * `assessment` out of room participation state, and classifies authoritative server refusals
 * into named review states without inventing a grade or a fallback.
 */

import {
  assertDeliverableReview,
  classifyAssessmentFailure,
  participationModeFromRoom,
} from '../transferAssessmentUiAdapter';
import {
  CHECKLIST_ID,
  CHECKLIST_ITEM_ID,
  LEARNER_A_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  preparedCandidate,
} from '../../test-support/transferRoomFixtures';

const scope = {
  roomId: TRANSFER_ROOM_ID,
  studentId: LEARNER_A_ID,
  checklistId: CHECKLIST_ID,
  itemId: CHECKLIST_ITEM_ID as string | null,
  focusStudentMessageId: LEARNER_A_MESSAGE_ID,
};

// The adapter imports component 102's facade, which constructs the Supabase client at module
// load. These checks never call the transport, so it is replaced here.
jest.mock('../../services/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() }, from: jest.fn(), channel: jest.fn(), storage: { from: jest.fn() } },
}));

describe('transferAssessmentUiAdapter mode and target contract', () => {
  it('accepts a confirmed assessment turn with its prepared item', () => {
    expect(assertDeliverableReview(preparedCandidate, scope)).toEqual({ ok: true });
  });

  it('refuses an assessment turn whose checklist item is missing', () => {
    const result = assertDeliverableReview(preparedCandidate, { ...scope, itemId: null });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe('validation');
    expect(result.ok === false && result.message).toContain('item');
  });

  it('refuses a tutoring turn that still carries an assessment payload', () => {
    const decision = {
      ...preparedCandidate,
      decision: { mode: 'tutoring' as const, instruction: 'scaffolding' as const, target_item_id: null },
    };

    const result = assertDeliverableReview(decision, scope);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe('validation');
  });

  it('refuses assessment mode without the transfer_assess instruction', () => {
    const decision = {
      ...preparedCandidate,
      decision: { ...preparedCandidate.decision, instruction: 'scaffolding' as const },
    };

    const result = assertDeliverableReview(decision, scope);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe('validation');
  });

  it('refuses a target item the teacher was never offered', () => {
    const result = assertDeliverableReview(preparedCandidate, scope, [], [LEARNER_A_MESSAGE_ID]);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe('validation');
  });

  it('refuses an assessment whose transfer basis cites an unknown message', () => {
    const result = assertDeliverableReview(preparedCandidate, scope, [CHECKLIST_ITEM_ID], []);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe('validation');
  });

  it('never lets assessment become a room participation mode', () => {
    expect(participationModeFromRoom({ active_response_mode: 'guard' })).toBe('guard');
    expect(participationModeFromRoom({ active_response_mode: 'tutoring' })).toBe('tutoring');
    expect(participationModeFromRoom({ active_response_mode: 'assessment' })).toBeNull();
    expect(participationModeFromRoom({ active_response_mode: 'nonsense' })).toBeNull();
    expect(participationModeFromRoom({})).toBeNull();
  });

  it('classifies authoritative server refusals into named review states', () => {
    // The learner already has a delivered assessment: this delivery is superseded, not retried.
    expect(classifyAssessmentFailure(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered')).status)
      .toBe('superseded');
    // The focus message is no longer this learner's: the teacher must prepare the turn again.
    expect(classifyAssessmentFailure(new Error('WRONG_LEARNER: focus message belongs to another learner')).status)
      .toBe('validation');
    // There is no transfer checklist in this room, so the capability does not apply.
    expect(classifyAssessmentFailure(new Error('LEGACY_CHECKLIST: no transfer checklist')).status)
      .toBe('unavailable');
    expect(classifyAssessmentFailure(new Error('ITEM_VALIDATION_FAILED: invalid reviewed payload')).status)
      .toBe('validation');
    expect(classifyAssessmentFailure(new Error('ASSESSMENT_FEATURE_DISABLED: Transfer assessment is disabled')).status)
      .toBe('unavailable');
    expect(classifyAssessmentFailure(new Error('AI_PROVIDER_NOT_CONFIGURED: no provider')).status)
      .toBe('unavailable');
    expect(classifyAssessmentFailure(new Error('FORBIDDEN: principal is not authorized')).status)
      .toBe('unauthorized');
    expect(classifyAssessmentFailure(new Error('Assessment API request failed: network down')).status)
      .toBe('retryable');
    expect(classifyAssessmentFailure(undefined).status).toBe('retryable');
  });

  it('keeps the server code in the surfaced message and adds no provider payload', () => {
    const classified = classifyAssessmentFailure(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'));

    expect(classified.message).toContain('ASSESSMENT_ALREADY_OPEN');
    expect(classified.message).not.toContain('correct_option_ids');
  });
});
