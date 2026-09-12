#!/usr/bin/env node
/**
 * Test responsible for src/components/PublicAssessmentQuestion.tsx as rendered inside the learner
 * message surface: the public question projection and nothing else.
 *
 * Responsibility: prove that a delivered question renders its stem, its instruction and options
 * A-D in order, that an unrecorded selection type is shown as unavailable rather than invented,
 * and that no private assessment material reaches the DOM.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicAssessmentQuestion from '../PublicAssessmentQuestion';
import { projectRoomMessage } from '../../contexts/transferAssessmentUiAdapter';
import { deliveredPublicAssessment, deliveredQuestionRow, deliveredQuestionRowWithoutSelectionType } from '../../test-support/transferRoomFixtures';
import { expectNoPrivateAssessmentFields } from '../../test-support/transferPrivacyAssertions';

describe('PublicAssessmentQuestion', () => {
  it('renders the stem, the single-choice instruction, and the four options in order', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    render(<PublicAssessmentQuestion question={view.publicQuestion!} />);

    expect(screen.getByText(deliveredQuestionRow.content)).toBeInTheDocument();
    expect(screen.getByText('Choose one.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'A. Pay the fee quickly.',
      'B. Stop and verify the offer through an official channel.',
      'C. Forward the offer to a friend.',
      'D. Reply with your bank details.',
    ]);
  });

  it('shows an explicit unavailable instruction instead of inventing a selection type', () => {
    const view = projectRoomMessage(deliveredQuestionRowWithoutSelectionType);

    render(<PublicAssessmentQuestion question={view.publicQuestion!} />);

    expect(view.publicQuestion!.selectionType).toBeNull();
    expect(screen.getByText(/Answer type not recorded/)).toBeInTheDocument();
    expect(screen.queryByText('Choose one.')).not.toBeInTheDocument();
    expect(screen.queryByText('Select all that apply.')).not.toBeInTheDocument();
  });

  it('renders only public material even when the stored row carried private fields', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    const { container } = render(<PublicAssessmentQuestion question={view.publicQuestion!} />);

    expect(container.innerHTML).not.toContain('assessment_key');
    expect(container.textContent).not.toContain('Stop and verify the offer through an official channel.,');
    expectNoPrivateAssessmentFields(view.publicQuestion);
  });
});
