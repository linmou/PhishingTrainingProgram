#!/usr/bin/env node
/**
 * Test responsible for the learner answer lifecycle projection in
 * src/contexts/transferAssessmentUiAdapter.ts.
 *
 * Responsibility: prove the trusted processing result is consumed as the server reports it —
 * graded, clarification, already processed, or unresolved — that the delivered question is still
 * projected from an answered row, and that the projection never carries private material.
 */

import {
  answerLifecycleFromProcessed,
  projectRoomMessage,
  readAnswerLifecycle,
  withAnswerLifecycle,
} from '../transferAssessmentUiAdapter';
import {
  DELIVERED_QUESTION_ID,
  deliveredQuestionRow,
  deliveredQuestionRowWithoutSelectionType,
} from '../../test-support/transferRoomFixtures';
import { expectNoPrivateAssessmentFields } from '../../test-support/transferPrivacyAssertions';
import type { Message } from '../../types';

describe('transferAssessmentUiAdapter answer lifecycle', () => {
  it('reports a graded answer from the key the RPC actually returns', () => {
    const lifecycle = answerLifecycleFromProcessed({
      message_id: DELIVERED_QUESTION_ID,
      result: 'pass',
      selected_option_ids: ['B'],
      transition: { status: 'covered' },
      feedback_required: true,
      code: null,
      clarification_required: false,
      already_processed: false,
    });

    expect(lifecycle).toEqual({
      state: 'graded',
      messageId: DELIVERED_QUESTION_ID,
      code: null,
      feedbackRequired: true,
    });
  });

  it('reports the server clarification request instead of a grade or a failure', () => {
    const lifecycle = answerLifecycleFromProcessed({
      message_id: DELIVERED_QUESTION_ID,
      result: null,
      selected_option_ids: null,
      transition: null,
      feedback_required: false,
      code: 'ANSWER_FORMAT_UNRESOLVED',
      clarification_required: true,
      already_processed: false,
    });

    expect(lifecycle.state).toBe('clarification');
    expect(lifecycle.code).toBe('ANSWER_FORMAT_UNRESOLVED');
  });

  it('treats a clarification flag as clarification even without the code', () => {
    expect(answerLifecycleFromProcessed({ message_id: DELIVERED_QUESTION_ID, clarification_required: true }).state)
      .toBe('clarification');
  });

  it('reports an idempotent replay as already processed', () => {
    const lifecycle = answerLifecycleFromProcessed({
      message_id: DELIVERED_QUESTION_ID,
      result: 'pass',
      already_processed: true,
    });

    expect(lifecycle.state).toBe('already_processed');
  });

  it('stays unresolved when the server returned no verdict at all', () => {
    expect(answerLifecycleFromProcessed({}).state).toBe('unresolved');
    expect(answerLifecycleFromProcessed(undefined).state).toBe('unresolved');
  });

  it('still accepts the older question_id key so a not-yet-promoted facade cannot break the view', () => {
    expect(answerLifecycleFromProcessed({ question_id: DELIVERED_QUESTION_ID, result: 'fail' }).messageId)
      .toBe(DELIVERED_QUESTION_ID);
  });

  it('attaches the lifecycle to a projected answer without inventing a grade', () => {
    const view = withAnswerLifecycle(
      projectRoomMessage({
        id: 'answer-1',
        room_id: deliveredQuestionRow.room_id,
        user_id: deliveredQuestionRow.user_id,
        content: 'B or D',
        user_role: 'student',
        created_at: '2026-09-12T09:15:00Z',
      }),
      answerLifecycleFromProcessed({ message_id: DELIVERED_QUESTION_ID, clarification_required: true })
    );

    expect(readAnswerLifecycle(view as unknown as Message)!.state).toBe('clarification');
    expect(view.publicQuestion).toBeNull();
    expectNoPrivateAssessmentFields(view);
  });

  it('projects an answered question row without the private key', () => {
    const view = projectRoomMessage({ ...deliveredQuestionRow, assessment_lifecycle: 'answered' });

    expect(view.publicQuestion!.id).toBe(DELIVERED_QUESTION_ID);
    expect(view.publicQuestion!.selectionType).toBe('single');
    expect(view.answerLifecycle).toBeNull();
    expectNoPrivateAssessmentFields(view);
  });

  it('keeps the pre-migration row honest about an unrecorded selection type', () => {
    const view = projectRoomMessage(deliveredQuestionRowWithoutSelectionType);

    expect(view.publicQuestion!.selectionType).toBeNull();
    expectNoPrivateAssessmentFields(view);
  });
});
