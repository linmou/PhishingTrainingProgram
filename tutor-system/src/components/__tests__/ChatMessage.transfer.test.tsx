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
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../PostComment';
import { projectRoomMessage } from '../../contexts/transferAssessmentUiAdapter';
import {
  deliveredPublicAssessment,
  deliveredQuestionRow,
  LEARNER_A_ID,
  learnerAMessageRow,
  preparedCandidate,
} from '../../test-support/transferRoomFixtures';
import { transferAssessmentService } from '../../services/transferAssessmentService';

jest.mock('../AvatarDisplay', () => function MockAvatarDisplay({ displayName }: { displayName: string }) {
  return <span data-testid="avatar">{displayName}</span>;
});

describe('PostComment transfer assessment compatibility gate', () => {
  afterEach(() => jest.restoreAllMocks());

  it('loads private review only on tutor request and hides it when the viewer changes', async () => {
    const read = jest.spyOn(transferAssessmentService, 'readReview').mockResolvedValue({
      item_label: 'Verify independently', assessment: preparedCandidate.assessment,
    });
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const { rerender } = render(<PostComment message={message} currentUserId="tutor-1" currentUserRole="tutor" />);
    expect(read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View tutor answer key and context' }));
    expect(await screen.findByText('Correct answer:')).toBeInTheDocument();
    expect(read).toHaveBeenCalledWith(message.room_id, deliveredPublicAssessment.id);
    for (const role of ['student', 'observer', 'tutor']) {
      rerender(<PostComment message={message} currentUserId="another-user" currentUserRole={role} />);
      expect(screen.queryByText('Correct answer:')).not.toBeInTheDocument();
      expect(screen.queryByText(preparedCandidate.assessment.transfer_basis.source_context)).not.toBeInTheDocument();
    }
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps rejected private reads recoverable without showing private content', async () => {
    jest.spyOn(transferAssessmentService, 'readReview').mockRejectedValue(new Error('FORBIDDEN'));
    const message = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    render(<PostComment message={message} currentUserId="tutor-1" currentUserRole="tutor" />);
    fireEvent.click(screen.getByRole('button', { name: 'View tutor answer key and context' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Correct answer:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View tutor answer key and context' })).toBeEnabled();
  });
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
