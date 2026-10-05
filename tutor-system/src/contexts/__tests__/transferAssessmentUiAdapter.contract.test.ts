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
  answerLifecycleFromProcessed,
  classifyAssessmentFailure,
  participationModeFromRoom,
} from '../transferAssessmentUiAdapter';
import {
  CHECKLIST_ID,
  CHECKLIST_ITEM_ID,
  LEARNER_A_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  duplicateTabTerminalStates,
  processedCorrectTerminal,
  processedDeferredTerminalFailure,
  processedFirstIncorrectRetry,
  processedSecondIncorrectTerminal,
  preparedCandidate,
} from '../../test-support/transferRoomFixtures';
import type { ProcessedMessageDTO } from '../../services/transferAssessmentService';
import { AssessmentApiRequestError } from '../../services/transferAssessmentService';

const scope = {
  roomId: TRANSFER_ROOM_ID,
  studentId: LEARNER_A_ID,
  checklistId: CHECKLIST_ID,
  itemId: CHECKLIST_ITEM_ID,
  focusStudentMessageId: LEARNER_A_MESSAGE_ID,
};

// The adapter imports component 102's facade, which constructs the Supabase client at module
// load. These checks never call the transport, so it is replaced here.
jest.mock('../../services/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() }, from: jest.fn(), channel: jest.fn(), storage: { from: jest.fn() } },
}));

describe('transferAssessmentUiAdapter mode and target contract', () => {
  it('keeps lifecycle fixtures on component 102 canonical ProcessedMessageDTO keys', () => {
    const fixtures: ProcessedMessageDTO[] = [
      processedFirstIncorrectRetry,
      processedCorrectTerminal,
      processedSecondIncorrectTerminal,
      processedDeferredTerminalFailure,
      duplicateTabTerminalStates.secondTab,
    ];
    const canonicalKeys = [
      'message_id',
      'assessment_id',
      'processing_state',
      'answer_outcome',
      'attempt_number',
      'attempts_used',
      'attempts_remaining',
      'selected_option_ids',
      'terminal',
      'transition',
      'feedback_required',
      'code',
      'already_processed',
      'terminal_failure_feedback',
    ];

    fixtures.forEach((processed) => expect(Object.keys(processed)).toEqual(canonicalKeys));
    expect(processedDeferredTerminalFailure).toMatchObject({
      processing_state: 'deferred',
      answer_outcome: 'failed',
      terminal: true,
    });
    expect(answerLifecycleFromProcessed(processedDeferredTerminalFailure)).toMatchObject({
      processingState: 'deferred',
      answerOutcome: 'failed',
      attemptsUsed: 2,
      attemptsRemaining: 0,
      terminal: true,
    });
  });

  it('keeps duplicate-tab replay on the same persisted terminal attempt', () => {
    const { firstTab, secondTab } = duplicateTabTerminalStates;
    const firstView = answerLifecycleFromProcessed(firstTab);
    const replayView = answerLifecycleFromProcessed(secondTab);

    expect(secondTab.message_id).toBe(firstTab.message_id);
    expect(secondTab.assessment_id).toBe(firstTab.assessment_id);
    expect(secondTab.already_processed).toBe(true);
    expect(replayView).toMatchObject({
      messageId: firstView.messageId,
      assessmentId: firstView.assessmentId,
      answerOutcome: firstView.answerOutcome,
      attemptNumber: firstView.attemptNumber,
      attemptsUsed: firstView.attemptsUsed,
      attemptsRemaining: firstView.attemptsRemaining,
      terminal: firstView.terminal,
      terminalFailureFeedback: firstView.terminalFailureFeedback,
      alreadyProcessed: true,
    });
  });

  it('accepts a confirmed assessment turn with its prepared item', () => {
    expect(assertDeliverableReview(preparedCandidate, scope)).toEqual({ ok: true });
  });

  it('refuses an assessment turn whose checklist item is missing', () => {
    const result = assertDeliverableReview(preparedCandidate, { ...scope, itemId: '' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe('validation');
    expect(result.ok === false && result.message).toContain('item');
  });

  it('refuses a draft with a tutor decision field', () => {
    const decision = {
      ...preparedCandidate,
      decision: { mode: 'tutoring' as const, instruction: 'scaffolding' as const, target_item_id: null },
    };

    const result = assertDeliverableReview(decision, scope);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe('validation');
  });

  it('refuses a draft with an unrelated instruction field', () => {
    const decision = {
      ...preparedCandidate,
      instruction: 'scaffolding',
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
    expect(classifyAssessmentFailure(new Error('ASSESSMENT_NOT_ELIGIBLE: target changed')).status)
      .toBe('superseded');
    // The prepared focus identity no longer matches, so the previous review is superseded.
    expect(classifyAssessmentFailure(new Error('WRONG_LEARNER: focus message belongs to another learner')).status)
      .toBe('superseded');
    // There is no transfer checklist in this room, so the capability does not apply.
    expect(classifyAssessmentFailure(new Error('LEGACY_CHECKLIST: no transfer checklist')).status)
      .toBe('unavailable');
    expect(classifyAssessmentFailure(new Error('TARGET_SETUP_REQUIRED: no approved items')).status)
      .toBe('unavailable');
    expect(classifyAssessmentFailure(new Error('ITEM_VALIDATION_FAILED: invalid reviewed payload')).status)
      .toBe('validation');
    expect(classifyAssessmentFailure(new Error('ASSESSMENT_FEATURE_DISABLED: Transfer assessment is disabled')).status)
      .toBe('unavailable');
    expect(classifyAssessmentFailure(new Error('AI_PROVIDER_NOT_CONFIGURED: no provider')).status)
      .toBe('unavailable');
    expect(classifyAssessmentFailure(new Error('ANALYSIS_INCOMPLETE: evidence pending')).status)
      .toBe('retryable');
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

  it('keeps local transfer setup failures distinct from the retry fallback', () => {
    const error = Object.assign(
      new Error('TARGET_SETUP_REQUIRED: Add at least one learning target'),
      { code: 'TARGET_SETUP_REQUIRED', retryable: false }
    );
    const classified = classifyAssessmentFailure(error);

    expect(classified.message).toBe(
      'TARGET_SETUP_REQUIRED: Add at least one learning target in Learning Progress before generating an assessment.'
    );
    expect(classified.message).not.toBe('The transfer request could not be completed. Try again.');
  });

  it('uses typed service error codes and hides raw provider details from review state', () => {
    const error = new AssessmentApiRequestError({
      code: 'AI_PROVIDER_ERROR',
      message: 'raw provider response includes a private payload',
      retryable: true,
    });
    const classified = classifyAssessmentFailure(error);

    expect(classified.status).toBe('retryable');
    expect(classified.message).toContain('AI_PROVIDER_ERROR');
    expect(classified.message).not.toContain('raw provider response');
    expect(classified.message).not.toContain('private payload');
  });
});
