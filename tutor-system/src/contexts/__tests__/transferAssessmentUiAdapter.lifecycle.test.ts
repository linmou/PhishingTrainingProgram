#!/usr/bin/env node
/**
 * Test responsible for the canonical learner-answer lifecycle projection in
 * src/contexts/transferAssessmentUiAdapter.ts.
 *
 * Responsibility: prove the UI consumes the trusted processed-message DTO, preserves attempt
 * metadata, exposes terminal feedback only when the server marks a terminal failure, and never
 * carries private assessment material into the projected room state.
 */

import {
  answerLifecycleFromProcessed,
  projectRoomMessage,
  readAnswerLifecycle,
  withAnswerLifecycle,
} from '../transferAssessmentUiAdapter';
import {
  DELIVERED_ANSWER_ID,
  DELIVERED_QUESTION_ID,
  deliveredQuestionRow,
} from '../../test-support/transferRoomFixtures';
import { expectNoPrivateAssessmentFields } from '../../test-support/transferPrivacyAssertions';
import type { Message } from '../../types';
import type { ProcessedMessageDTO } from '../../services/transferAssessmentService';

const baseProcessed: ProcessedMessageDTO = {
  message_id: DELIVERED_ANSWER_ID,
  assessment_id: DELIVERED_QUESTION_ID,
  processing_state: 'applied',
  answer_outcome: 'passed',
  attempt_number: 1,
  attempts_used: 1,
  attempts_remaining: 1,
  selected_option_ids: ['B'],
  terminal: false,
  transition: { status: 'covered' },
  feedback_required: false,
  code: null,
  already_processed: false,
  terminal_failure_feedback: null,
};

describe('transferAssessmentUiAdapter answer lifecycle', () => {
  it('projects a passed answer with the server attempt and transition metadata', () => {
    expect(answerLifecycleFromProcessed(baseProcessed)).toEqual({
      state: 'passed',
      messageId: DELIVERED_ANSWER_ID,
      assessmentId: DELIVERED_QUESTION_ID,
      processingState: 'applied',
      answerOutcome: 'passed',
      attemptNumber: 1,
      attemptsUsed: 1,
      attemptsRemaining: 1,
      selectedOptionIds: ['B'],
      terminal: false,
      transition: { status: 'covered' },
      code: null,
      feedbackRequired: false,
      alreadyProcessed: false,
      terminalFailureFeedback: null,
    });
  });

  it('reports a retry without inventing terminal feedback', () => {
    const lifecycle = answerLifecycleFromProcessed({
      ...baseProcessed,
      answer_outcome: 'retry',
      feedback_required: true,
      terminal_failure_feedback: {
        correct_option_ids: ['B'],
        learner_safe_explanation: 'Use an official channel to verify the request.',
      },
    });

    expect(lifecycle.state).toBe('retry');
    expect(lifecycle.feedbackRequired).toBe(true);
    expect(lifecycle.terminalFailureFeedback).toBeNull();
  });

  it('exposes the learner-safe explanation only for a terminal failed answer', () => {
    const lifecycle = answerLifecycleFromProcessed({
      ...baseProcessed,
      answer_outcome: 'failed',
      attempt_number: 2,
      attempts_used: 2,
      attempts_remaining: 0,
      terminal: true,
      feedback_required: true,
      terminal_failure_feedback: {
        correct_option_ids: ['B'],
        learner_safe_explanation: 'Use an official channel to verify the request.',
      },
    });

    expect(lifecycle.state).toBe('failed');
    expect(lifecycle.terminal).toBe(true);
    expect(lifecycle.terminalFailureFeedback).toEqual({
      correct_option_ids: ['B'],
      learner_safe_explanation: 'Use an official channel to verify the request.',
    });
  });

  it('keeps deferred processing distinct from a completed answer outcome', () => {
    const lifecycle = answerLifecycleFromProcessed({
      ...baseProcessed,
      processing_state: 'deferred',
      answer_outcome: null,
      attempt_number: null,
      attempts_used: 0,
      attempts_remaining: 2,
      selected_option_ids: null,
      terminal: false,
      transition: null,
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    });

    expect(lifecycle.state).toBe('deferred');
    expect(lifecycle.processingState).toBe('deferred');
    expect(lifecycle.answerOutcome).toBeNull();
  });

  it('reports duplicate and rejected server processing states', () => {
    expect(answerLifecycleFromProcessed({
      ...baseProcessed,
      processing_state: 'duplicate',
      answer_outcome: null,
      already_processed: true,
    }).state).toBe('duplicate');

    expect(answerLifecycleFromProcessed({
      ...baseProcessed,
      processing_state: 'rejected',
      answer_outcome: null,
      code: 'ANSWER_FORMAT_UNRESOLVED',
    }).state).toBe('rejected');
  });

  it('attaches the canonical lifecycle to a projected answer without exposing private fields', () => {
    const view = withAnswerLifecycle(
      projectRoomMessage({
        id: DELIVERED_ANSWER_ID,
        room_id: deliveredQuestionRow.room_id,
        user_id: deliveredQuestionRow.user_id,
        content: 'B',
        user_role: 'student',
        created_at: '2026-09-12T09:15:00Z',
      }),
      answerLifecycleFromProcessed({ ...baseProcessed, message_id: DELIVERED_ANSWER_ID })
    );

    expect(readAnswerLifecycle(view as unknown as Message)!.state).toBe('passed');
    expect(view.publicQuestion).toBeNull();
    expectNoPrivateAssessmentFields(view);
  });

  it('projects a delivered question with its public selection type and no private key', () => {
    const view = projectRoomMessage(deliveredQuestionRow);

    expect(view.publicQuestion!.id).toBe(DELIVERED_QUESTION_ID);
    expect(view.publicQuestion!.studentId).toBe(deliveredQuestionRow.assessment.student_id);
    expect(view.publicQuestion!.selectionType).toBe('single');
    expect(view.answerLifecycle).toBeNull();
    expectNoPrivateAssessmentFields(view);
  });
});
