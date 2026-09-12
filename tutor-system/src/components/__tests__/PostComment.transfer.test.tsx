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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../PostComment';
import { projectRoomMessage } from '../../contexts/transferAssessmentUiAdapter';
import {
  deliveredPublicAssessment,
  deliveredQuestionRow,
  learnerAMessageRow,
} from '../../test-support/transferRoomFixtures';

describe('PostComment transfer assessment rendering', () => {
  it('renders the delivered public question with its options in order', () => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    const { container } = render(
      <PostComment message={message} currentUserId="learner-a" currentUserRole="student" />
    );

    expect(screen.getByText(deliveredQuestionRow.content)).toBeInTheDocument();
    expect(screen.getByText('Choose one.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'A. Pay the fee quickly.',
      'B. Stop and verify the offer through an official channel.',
      'C. Forward the offer to a friend.',
      'D. Reply with your bank details.',
    ]);
    expect(container.innerHTML).not.toContain('assessment_key');
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
});
