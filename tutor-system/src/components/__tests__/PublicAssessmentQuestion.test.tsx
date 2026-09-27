#!/usr/bin/env node
/**
 * Test responsible for src/components/PublicAssessmentQuestion.tsx as rendered inside the learner
 * message surface: the public question projection and nothing else.
 *
 * Responsibility: prove that a delivered question renders its public controls and options without
 * exposing private assessment material.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicAssessmentQuestion from '../PublicAssessmentQuestion';
import { answerLifecycleFromProcessed, projectRoomMessage } from '../../contexts/transferAssessmentUiAdapter';
import { deliveredPublicAssessment, deliveredQuestionRow } from '../../test-support/transferRoomFixtures';
import { expectNoPrivateAssessmentFields } from '../../test-support/transferPrivacyAssertions';
import type { ProcessedMessageDTO } from '../../services/transferAssessmentService';

const processedAnswer = (overrides: Partial<ProcessedMessageDTO> = {}) => answerLifecycleFromProcessed({
  message_id: '99999999-9999-4999-8999-999999999999',
  assessment_id: deliveredPublicAssessment.id,
  processing_state: 'applied',
  answer_outcome: 'passed',
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
  ...overrides,
});

describe('PublicAssessmentQuestion', () => {
  it('renders the stem, the single-choice instruction, and the four options in order', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    render(<PublicAssessmentQuestion question={view.publicQuestion!} />);

    expect(screen.getByText(deliveredQuestionRow.content)).toBeInTheDocument();
    expect(screen.getAllByText(deliveredQuestionRow.content)).toHaveLength(1);
    expect(screen.getByText('Choose one.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'A. Pay the fee quickly.',
      'B. Stop and verify the offer through an official channel.',
      'C. Forward the offer to a friend.',
      'D. Reply with your bank details.',
    ]);
  });

  it('renders radio controls for the canonical single-selection DTO', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    render(<PublicAssessmentQuestion question={view.publicQuestion!} canAnswer />);

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders only public material even when the stored row carried private fields', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);

    const { container } = render(<PublicAssessmentQuestion question={view.publicQuestion!} />);

    expect(container.innerHTML).not.toContain('assessment_key');
    expect(container.innerHTML).not.toContain('rendered_text');
    expect(container.textContent).not.toContain('Stop and verify the offer through an official channel.,');
    expect(view.publicQuestion).not.toHaveProperty('rendered_text');
    expectNoPrivateAssessmentFields(view.publicQuestion);
  });

  it('submits multiple selections in canonical option order', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const onSubmit = jest.fn();
    render(
      <PublicAssessmentQuestion
        question={{ ...view.publicQuestion!, selectionType: 'multiple' }}
        canAnswer
        onSubmit={onSubmit}
      />
    );

    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    const submit = screen.getByRole('button', { name: 'Submit answer' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /B\./ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /A\./ }));
    expect(submit).toBeEnabled();
    view.publicQuestion!.options.forEach((option) => {
      expect(screen.getAllByText(`${option.id}. ${option.text}`)).toHaveLength(1);
    });

    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith(['A', 'B']);
  });

  it('shows only the remaining chance after a server-reported retry', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    render(
      <PublicAssessmentQuestion
        question={view.publicQuestion!}
        answerLifecycle={processedAnswer({
          answer_outcome: 'retry',
          attempt_number: 1,
          attempts_used: 1,
          attempts_remaining: 1,
          feedback_required: true,
          terminal_failure_feedback: {
            correct_option_ids: ['B'],
            learner_safe_explanation: 'Use an official channel to verify the request.',
          },
        })}
        canAnswer
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Incorrect. 1 attempt remaining.');
    expect(screen.queryByText('Use an official channel to verify the request.')).not.toBeInTheDocument();
    expect(screen.queryByText('Correct option(s): B')).not.toBeInTheDocument();
  });

  it('disables further answers after the server reports a correct outcome', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const { rerender } = render(
      <PublicAssessmentQuestion
        question={view.publicQuestion!}
        answerLifecycle={processedAnswer({ answer_outcome: 'passed', terminal: false })}
        canAnswer
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Correct.');
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);

    rerender(
      <PublicAssessmentQuestion
        question={view.publicQuestion!}
        answerLifecycle={processedAnswer({ answer_outcome: 'passed', terminal: true })}
        canAnswer
      />
    );
    expect(screen.queryByText(/Correct option\(s\):/)).not.toBeInTheDocument();
  });

  it.each(['applied', 'deferred', 'duplicate'] as const)(
    'reveals terminal server feedback for %s processing and disables another answer',
    (processingState) => {
      const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
      render(
        <PublicAssessmentQuestion
          question={view.publicQuestion!}
          answerLifecycle={processedAnswer({
            processing_state: processingState,
            answer_outcome: 'failed',
            attempt_number: 2,
            attempts_used: 2,
            attempts_remaining: 0,
            terminal: true,
            feedback_required: true,
            already_processed: processingState === 'duplicate',
            terminal_failure_feedback: {
              correct_option_ids: ['B'],
              learner_safe_explanation: 'Use an official channel to verify the request.',
            },
          })}
          canAnswer
        />
      );

      expect(screen.getByRole('status')).toHaveTextContent('Use an official channel to verify the request.');
      expect(screen.getByRole('status')).toHaveTextContent('Correct option(s): B');
      expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    }
  );

  it('does not invent feedback for a rejected answer with no outcome', () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    render(
      <PublicAssessmentQuestion
        question={view.publicQuestion!}
        answerLifecycle={processedAnswer({
          processing_state: 'rejected',
          answer_outcome: null,
          attempt_number: null,
          attempts_used: 0,
          attempts_remaining: 2,
          selected_option_ids: null,
          code: 'ANSWER_FORMAT_UNRESOLVED',
        })}
        canAnswer
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This answer was rejected. Please try again.');
    expect(screen.queryByText('Incorrect.')).not.toBeInTheDocument();
    expect(screen.queryByText('Correct.')).not.toBeInTheDocument();
  });

  it('disables answer controls while the server request is pending', async () => {
    const view = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    let resolveSubmission: () => void = () => undefined;
    const onSubmit = jest.fn(() => new Promise<void>((resolve) => {
      resolveSubmission = resolve;
    }));
    render(
      <PublicAssessmentQuestion question={view.publicQuestion!} canAnswer onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByRole('radio', { name: /A\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(screen.getByRole('button', { name: 'Submitting answer…' })).toBeDisabled();
    expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);

    await act(async () => resolveSubmission());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit answer' })).toBeEnabled());
  });
});
