#!/usr/bin/env node
/**
 * Test responsible for src/components/PostComment.tsx on the transfer-assessment path: the room's
 * comment surface renders a delivered question for the learner and stays ordinary for other
 * messages, without teacher-only metadata.
 *
 * Responsibility: prove the post-style room view shows the public question and never the private
 * key or teacher-only assessment metadata.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../PostComment';
import {
  answerLifecycleFromProcessed,
  projectRoomMessage,
  withAnswerLifecycle,
} from '../../contexts/transferAssessmentUiAdapter';
import {
  DELIVERED_ANSWER_ID,
  LEARNER_A_ID,
  deliveredPublicAssessment,
  deliveredQuestionRow,
  learnerAMessageRow,
} from '../../test-support/transferRoomFixtures';

describe('PostComment transfer assessment rendering', () => {
  it('renders the delivered public question with its options in order', () => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    const { container } = render(
      <PostComment message={message} currentUserId={LEARNER_A_ID} currentUserRole="student" />
    );

    expect(screen.getByText(deliveredQuestionRow.content)).toBeInTheDocument();
    expect(screen.getByText('Choose one.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'A. Pay the fee quickly.',
      'B. Stop and verify the offer through an official channel.',
      'C. Forward the offer to a friend.',
      'D. Reply with your bank details.',
    ]);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    [
      'assessment_key',
      'transfer_basis',
      'correct_option_ids',
      'learner_safe_explanation',
      'rationale',
      'rendered_text',
      'raw_model_output',
    ].forEach((field) => expect(container.innerHTML).not.toContain(field));
  });

  it.each([
    ['tutor', 'tutor'],
    ['observer', 'observer'],
  ])('keeps the question read-only for the %s', (role, userId) => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    render(<PostComment message={message} currentUserId={userId} currentUserRole={role} />);

    expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
  });

  it('renders an ordinary learner message without a question block', () => {
    const message = projectRoomMessage(learnerAMessageRow);

    render(<PostComment message={message} currentUserId="learner-a" currentUserRole="student" />);

    expect(screen.getByText(learnerAMessageRow.content)).toBeInTheDocument();
    expect(screen.queryByText('Choose one.')).not.toBeInTheDocument();
    expect(screen.queryByText(/transfer basis|rationale|answer key/i)).not.toBeInTheDocument();
  });

  it('keeps the guard-mode author rendering intact', () => {
    const message = { ...projectRoomMessage(deliveredQuestionRow), response_mode: 'guard' as const };

    render(<PostComment message={message} currentUserId="learner-a" currentUserRole="student" />);

    expect(screen.getByText('Security Supervisor')).toBeInTheDocument();
  });

  it.each([
    ['student', 'learner-a'],
    ['tutor', 'tutor'],
    ['observer', 'observer'],
  ])('starts expanded and allows %s to collapse and expand the question', (role, userId) => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const { container } = render(
      <PostComment message={message} currentUserId={role === 'student' ? LEARNER_A_ID : userId} currentUserRole={role} />
    );

    const question = within(container).getByText(deliveredQuestionRow.content);
    const collapse = within(container).getByRole('button', { name: 'Collapse assessment question' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(question).toBeVisible();

    fireEvent.click(collapse);
    expect(within(container).getByRole('button', { name: 'Expand assessment question' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(question).not.toBeVisible();

    fireEvent.click(within(container).getByRole('button', { name: 'Expand assessment question' }));
    expect(question).toBeVisible();
  });

  it('keeps each mounted participant view independent and preserves selection and retry feedback', () => {
    const question = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const message = withAnswerLifecycle(question, answerLifecycleFromProcessed({
      message_id: DELIVERED_ANSWER_ID,
      assessment_id: deliveredQuestionRow.id,
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
    }));
    const otherParticipantMessage = {
      ...message,
      id: `${message.id}-observer-view`,
      publicQuestion: message.publicQuestion
        ? { ...message.publicQuestion, id: `${message.publicQuestion.id}-observer-view` }
        : null,
    };
    const { container } = render(
      <>
        <PostComment message={message} currentUserId={LEARNER_A_ID} currentUserRole="student" />
        <PostComment message={otherParticipantMessage} currentUserId="tutor" currentUserRole="tutor" />
      </>
    );

    const controls = screen.getAllByRole('button', { name: 'Collapse assessment question' });
    fireEvent.click(within(container.querySelectorAll('.post-comment')[0] as HTMLElement)
      .getByRole('radio', { name: /B\./ }));
    fireEvent.click(controls[0]);

    const firstView = container.querySelectorAll('.post-comment')[0] as HTMLElement;
    const secondView = container.querySelectorAll('.post-comment')[1] as HTMLElement;
    expect(within(firstView).getByRole('button', { name: 'Expand assessment question' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(within(secondView).getByRole('button', { name: 'Collapse assessment question' }))
      .toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(within(firstView).getByRole('button', { name: 'Expand assessment question' }));
    expect(within(firstView).getByRole('radio', { name: /B\./ })).toBeChecked();
    expect(within(firstView).getByText('Incorrect. 1 attempt remaining.')).toBeVisible();
  });
});
