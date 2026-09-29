#!/usr/bin/env node
/**
 * Contract tests for src/contexts/transferAssessmentUiAdapter.ts, covering the teacher-private
 * versus learner-public projection, required scope identity, and fail-closed behavior.
 *
 * Responsibility: prove the React boundary never retains private assessment material and never
 * invents identity or a public payload it was not given.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../../components/PostComment';
import {
  answerLifecycleFromProcessed,
  createReviewCandidate,
  mergeRoomMessages,
  projectRoomMessage,
  publicAssessmentForDecision,
  readPublicQuestion,
} from '../transferAssessmentUiAdapter';
import {
  CHECKLIST_ID,
  CHECKLIST_ITEM_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_ID,
  LEARNER_B_ID,
  OBSERVER_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  deliveredMultiplePublicAssessment,
  deliveredMultipleQuestionRow,
  deliveredPublicAssessment,
  deliveredQuestionRow,
  learnerAMessageRow,
  learnerBMessageRow,
  preparedCandidate,
  preparedTurnResult,
  preparedTutoringTurnResult,
  rowWithPrivateMaterial,
} from '../../test-support/transferRoomFixtures';
import { expectNoPrivateAssessmentFields } from '../../test-support/transferPrivacyAssertions';
import type { Message } from '../../types';
import type { PublicAssessmentDTO } from '../../services/transferAssessmentService';

// The adapter imports component 102's facade, which constructs the Supabase client at module
// load. The transport is never used by these projections, so it is replaced here.
jest.mock('../../services/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() }, from: jest.fn(), channel: jest.fn(), storage: { from: jest.fn() } },
}));

describe('transferAssessmentUiAdapter projections', () => {
  it('consumes the canonical PublicAssessmentDTO fields without private text fields', () => {
    const assessment: PublicAssessmentDTO = deliveredPublicAssessment;

    expect(Object.keys(assessment)).toEqual(['id', 'student_id', 'selection_type', 'stem', 'options']);
    expect(assessment).not.toHaveProperty('rendered_text');
    expectNoPrivateAssessmentFields(assessment);
  });

  it('preserves the canonical multiple-selection type through the public projection', () => {
    const assessment: PublicAssessmentDTO = deliveredMultiplePublicAssessment;
    const message = projectRoomMessage(deliveredMultipleQuestionRow, assessment);

    expect(message.publicQuestion).toMatchObject({
      id: assessment.id,
      studentId: assessment.student_id,
      selectionType: 'multiple',
      stem: assessment.stem,
    });
    expect(message.publicQuestion!.options).toHaveLength(4);
  });

  it('shows answer controls only to the matching learner and sends no student identity as authority', () => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const onSubmitAssessment = jest.fn();

    render(React.createElement(PostComment, {
      message,
      currentUserId: LEARNER_A_ID,
      currentUserRole: 'student',
      onSubmitAssessment,
    }));

    expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /B\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(onSubmitAssessment).toHaveBeenCalledWith(DELIVERED_QUESTION_ID, deliveredPublicAssessment.id, ['B']);
    expect(onSubmitAssessment.mock.calls[0]).toHaveLength(3);
    expect(JSON.stringify(onSubmitAssessment.mock.calls[0])).not.toContain(LEARNER_A_ID);
  });

  it('fails closed when the target learner identity is missing', () => {
    const missingTarget = { ...deliveredPublicAssessment, student_id: '' } as PublicAssessmentDTO;
    const message = projectRoomMessage(deliveredQuestionRow, missingTarget);

    expect(message.publicQuestion).toBeNull();
    render(React.createElement(PostComment, {
      message,
      currentUserId: LEARNER_A_ID,
      currentUserRole: 'student',
    }));

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
  });

  it('keeps target-mismatched learners, teachers, and observers read-only', () => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const participants = [
      { id: LEARNER_B_ID, role: 'student' },
      { id: 'tutor-viewer', role: 'tutor' },
      { id: OBSERVER_ID, role: 'observer' },
    ];

    participants.forEach(({ id, role }) => {
      const { unmount } = render(React.createElement(PostComment, {
        message,
        currentUserId: id,
        currentUserRole: role,
      }));

      expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
      expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
      unmount();
    });
  });

  it('projects a delivered question message without the private answer key', () => {
    const view = projectRoomMessage(deliveredQuestionRow);

    expect(view.id).toBe(DELIVERED_QUESTION_ID);
    expect(view.parent_message_id).toBe(LEARNER_A_MESSAGE_ID);
    expect(view.publicQuestion).not.toBeNull();
    expect(view.publicQuestion!.id).toBe(DELIVERED_QUESTION_ID);
    expect(view.publicQuestion!.stem).toBe(deliveredQuestionRow.content);
    expect(view.publicQuestion!.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
    expectNoPrivateAssessmentFields(view);
  });

  it('drops every private assessment field a crafted stored row could carry', () => {
    const view = projectRoomMessage(rowWithPrivateMaterial);

    expectNoPrivateAssessmentFields(view);
    expect(JSON.stringify(view)).not.toContain('assessment_key');
  });

  it('leaves an ordinary learner message without a public question', () => {
    const view = projectRoomMessage(learnerAMessageRow);

    expect(view.publicQuestion).toBeNull();
    expect(readPublicQuestion(view as unknown as Message)).toBeNull();
  });

  it('takes the canonical selection type from the persisted row after a reload', () => {
    const view = projectRoomMessage(deliveredQuestionRow);

    expect(view.publicQuestion!.selectionType).toBe('single');
  });

  it('rebuilds the public question from allowlisted database columns with distinct message identity', () => {
    const questionMessageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const view = projectRoomMessage({
      ...deliveredQuestionRow,
      assessment: undefined,
      id: questionMessageId,
      assessment_id: DELIVERED_QUESTION_ID,
      assessment_student_id: LEARNER_A_ID,
      assessment_selection_type: 'multiple',
    });

    expect(view.id).toBe(questionMessageId);
    expect(view.publicQuestion).toMatchObject({
      id: DELIVERED_QUESTION_ID,
      studentId: LEARNER_A_ID,
      selectionType: 'multiple',
      stem: deliveredQuestionRow.content,
    });
    expect(view.publicQuestion!.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
    expectNoPrivateAssessmentFields(view);
    expect(JSON.stringify(view)).not.toContain('assessment_key');
  });

  it('prefers the explicit public projection on the delivery path over the persisted column', () => {
    const view = projectRoomMessage(deliveredQuestionRow, {
      id: DELIVERED_QUESTION_ID,
      student_id: LEARNER_A_ID,
      selection_type: 'multiple',
      stem: deliveredQuestionRow.content,
      options: deliveredQuestionRow.assessment_options as never,
    });

    expect(view.publicQuestion!.selectionType).toBe('multiple');
  });

  it('fails closed instead of returning a partial question for a malformed option set', () => {
    const view = projectRoomMessage({
      ...deliveredQuestionRow,
      assessment: { ...(deliveredQuestionRow.assessment as object), options: [{ id: 'A', text: 'only one' }] },
    });

    expect(view.publicQuestion).toBeNull();
  });

  it('keeps the prepared scope identity and rejects an absent assessment', () => {
    const candidate = createReviewCandidate(preparedTurnResult);
    const tutoring = preparedTutoringTurnResult && createReviewCandidate(preparedTutoringTurnResult);

    expect(candidate).not.toBeNull();
    expect(candidate!.scope).toEqual({
      roomId: TRANSFER_ROOM_ID,
      studentId: LEARNER_A_ID,
      checklistId: CHECKLIST_ID,
      itemId: CHECKLIST_ITEM_ID,
      focusStudentMessageId: LEARNER_A_MESSAGE_ID,
    });
    expect(tutoring).toBeNull();
  });

  it('fails closed when the preparation result is missing required identity', () => {
    const { student_id, ...withoutStudent } = preparedTurnResult as Record<string, unknown>;

    expect(student_id).toBe(LEARNER_A_ID);
    expect(createReviewCandidate(withoutStudent)).toBeNull();
    expect(createReviewCandidate({})).toBeNull();
  });

  it('projection of the reviewed decision is public-only and carries no key', () => {
    const projection = publicAssessmentForDecision(preparedCandidate, DELIVERED_QUESTION_ID, LEARNER_A_ID);

    expect(projection).not.toBeNull();
    expect(projection!.id).toBe(DELIVERED_QUESTION_ID);
    expect(projection!.student_id).toBe(LEARNER_A_ID);
    expect(projection).not.toHaveProperty('rendered_text');
    expect(projection!.options).toHaveLength(4);
    expectNoPrivateAssessmentFields(projection);
  });

  it('merges persisted messages by stable identity and keeps chronological order', () => {
    const first = projectRoomMessage(learnerAMessageRow);
    const second = projectRoomMessage(learnerBMessageRow);
    const corrected = { ...first, content: 'edited content' };
    const late = projectRoomMessage({
      ...learnerBMessageRow,
      id: LEARNER_A_MESSAGE_ID,
      content: 'from the realtime channel',
      created_at: '2026-09-12T08:59:00Z',
    });

    const merged = mergeRoomMessages([first], [second]);
    expect(merged.map((message) => message.id)).toEqual([learnerBMessageRow.id, LEARNER_A_MESSAGE_ID]);

    const deduped = mergeRoomMessages([first], [late]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].content).toBe('from the realtime channel');

    const replaced = mergeRoomMessages([first, second], [corrected]);
    expect(replaced).toHaveLength(2);
    expect(replaced.find((message) => message.id === LEARNER_A_MESSAGE_ID)!.content).toBe('edited content');
  });

  it('preserves a trusted answer lifecycle when polling replaces a local view with a raw row', () => {
    const answer = projectRoomMessage({
      id: 'answer-restore',
      room_id: TRANSFER_ROOM_ID,
      user_id: LEARNER_A_ID,
      content: 'B',
      user_role: 'student',
      parent_message_id: DELIVERED_QUESTION_ID,
      created_at: '2026-09-12T09:15:00Z',
    });
    const withLifecycle = {
      ...answer,
      answerLifecycle: answerLifecycleFromProcessed({
        message_id: 'answer-restore',
        assessment_id: DELIVERED_QUESTION_ID,
        processing_state: 'applied',
        answer_outcome: 'retry',
        attempt_number: 1,
        attempts_used: 1,
        attempts_remaining: 1,
        selected_option_ids: ['B'],
        terminal: false,
        transition: null,
        feedback_required: false,
        code: null,
        already_processed: false,
        terminal_failure_feedback: null,
      }),
    };

    const merged = mergeRoomMessages([withLifecycle], [answer]);

    expect(merged[0]).toMatchObject({
      id: 'answer-restore',
      answerLifecycle: { state: 'retry', assessmentId: DELIVERED_QUESTION_ID, attemptsRemaining: 1 },
    });
  });

  it('keeps pre-populated messages first and does not drop a realtime message the fetch does not know', () => {
    const prepopulated = {
      ...projectRoomMessage(learnerAMessageRow),
      id: 'prepop-room-0',
      user_id: 'system',
      content: 'scripted line',
      created_at: '2026-09-12T08:00:01Z',
    } as Message;
    const realtimeOnly = projectRoomMessage(learnerBMessageRow);

    const merged = mergeRoomMessages([prepopulated, realtimeOnly], [projectRoomMessage(learnerAMessageRow)]);

    expect(merged.map((message) => message.id)).toEqual([
      'prepop-room-0',
      learnerBMessageRow.id,
      LEARNER_A_MESSAGE_ID,
    ]);
  });
});
