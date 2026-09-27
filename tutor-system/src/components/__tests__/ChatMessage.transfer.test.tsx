#!/usr/bin/env node
/**
 * Test responsible for src/components/PostComment.tsx on the transfer-assessment path: a
 * delivered question message renders its public question for the learner. The filename is
 * retained because the earlier focused gate still selects it.
 *
 * Responsibility: prove the learner sees the stem and options (not only the stem text) and that
 * the private answer key never reaches the rendered output.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../PostComment';
import { projectRoomMessage } from '../../contexts/transferAssessmentUiAdapter';
import {
  deliveredPublicAssessment,
  deliveredQuestionRow,
  LEARNER_A_ID,
  learnerAMessageRow,
} from '../../test-support/transferRoomFixtures';

jest.mock('../AvatarDisplay', () => function MockAvatarDisplay({ displayName }: { displayName: string }) {
  return <span data-testid="avatar">{displayName}</span>;
});

describe('PostComment transfer assessment compatibility gate', () => {
  it('renders the delivered public question with its options in order', () => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    const { container } = render(<PostComment message={message} currentUserId={LEARNER_A_ID} currentUserRole="student" />);

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

  it('keeps an ordinary learner message unchanged', () => {
    const message = projectRoomMessage(learnerAMessageRow);

    render(<PostComment message={message} currentUserId={LEARNER_A_ID} currentUserRole="student" />);

    expect(screen.getByText(learnerAMessageRow.content)).toBeInTheDocument();
    expect(screen.queryByText('Choose one.')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('never renders the correct option as a marked answer', () => {
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    render(<PostComment message={message} currentUserId={LEARNER_A_ID} currentUserRole="student" />);

    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
  });
});
