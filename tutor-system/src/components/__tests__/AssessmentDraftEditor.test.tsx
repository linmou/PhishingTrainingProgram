#!/usr/bin/env node
/**
 * Test responsible for src/components/AssessmentDraftEditor.tsx: the structured teacher review
 * surface for a prepared transfer-assessment candidate.
 *
 * Responsibility: prove the editor renders the tutor review controls, preserves required hidden
 * assessment data, sends valid edits directly, enforces content validation, and exposes its own
 * review states without writing progress.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssessmentDraftEditor from '../AssessmentDraftEditor';
import { preparedCandidate } from '../../test-support/transferRoomFixtures';
import type { TransferAssessmentDraft } from '../../types/assessment';

const optionInputs = (): HTMLInputElement[] =>
  Array.from(document.querySelectorAll('input[name="assessment-correct-option"]')) as HTMLInputElement[];

const optionTextInputs = (): HTMLInputElement[] =>
  Array.from(document.querySelectorAll('fieldset label input:not([name="assessment-correct-option"])')) as HTMLInputElement[];

const selectKey = (label: string) => {
  const ids = ['A', 'B', 'C', 'D'];
  fireEvent.click(optionInputs()[ids.indexOf(label)]);
};

describe('AssessmentDraftEditor', () => {
  it('renders the compact review controls without learner preview or confirmation controls', () => {
    const { container } = render(
      <AssessmentDraftEditor decision={preparedCandidate} itemLabel="Verify payment requests" onSubmit={jest.fn()} />
    );

    expect(screen.getByText('Target: Verify payment requests')).toBeInTheDocument();
    expect(optionTextInputs().map((input) => input.value)).toEqual([
      'Pay the fee quickly.',
      'Stop and verify the offer through an official channel.',
      'Forward the offer to a friend.',
      'Reply with your bank details.',
    ]);
    expect(container.querySelector('.assessment-draft-editor__preview')).not.toBeInTheDocument();
    expect(container.querySelector('.assessment-draft-editor__confirmation')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Learner-safe explanation')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /I confirm the concept/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send assessment' })).toBeInTheDocument();
  });

  it('sends edited content directly and preserves the prepared explanation', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    const editedQuestion = 'A caller asks for a release fee. What do you do first?';
    const editedOption = 'Call the organization using a known number.';
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: editedQuestion } });
    fireEvent.change(screen.getByLabelText('Option B'), { target: { value: editedOption } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0] as TransferAssessmentDraft;
    expect(submitted.target_item_id).toBe(preparedCandidate.target_item_id);
    expect(submitted.assessment.stem).toBe(editedQuestion);
    expect(submitted.assessment.correct_option_ids).toEqual(['B']);
    expect(submitted.assessment.learner_safe_explanation).toBe(
      preparedCandidate.assessment.learner_safe_explanation
    );
    expect(submitted.assessment.rendered_text).toContain(editedQuestion);
    expect(submitted.assessment.rendered_text).toContain(editedOption);
    expect(submitted.assessment.rendered_text).not.toContain(preparedCandidate.assessment.stem);
  });

  it('refuses a blank stem through the production rendering validator', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('stem must not be blank');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a blank answer option', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Option B'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/options.*nonempty/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a single-selection candidate without a correct answer', async () => {
    const onSubmit = jest.fn();
    const noCorrectAnswer = {
      ...preparedCandidate,
      assessment: { ...preparedCandidate.assessment!, correct_option_ids: [] },
    };
    render(<AssessmentDraftEditor decision={noCorrectAnswer} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose exactly one correct option.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires two or three keys for a multiple-selection question', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    // The candidate has a single key, so switching to multiple leaves an invalid cardinality.
    fireEvent.change(screen.getByLabelText('Answer type'), { target: { value: 'multiple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose two or three correct options.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps only one key when the question is single-selection', () => {
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={jest.fn()} />);

    selectKey('A');
    selectKey('D');

    expect(optionInputs()[0].checked).toBe(false);
    expect(optionInputs()[3].checked).toBe(true);
  });

  it('keeps valid edits ready for direct sending', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'An edited stem asks for a first step.' } });

    expect(screen.queryByLabelText(/I confirm the concept/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('reports its own review state, including unsaved edits', () => {
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={jest.fn()} />);

    const status = screen.getByTestId('assessment-review-status');
    expect(status).toHaveAttribute('data-review-status', 'ready');

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'An edited stem asks for a first step.' } });

    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'dirty');
    expect(screen.getByTestId('assessment-review-status')).toHaveTextContent('ready to send');
  });

  it('discards the candidate without submitting anything', () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Discard candidate' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers no control that writes progress', () => {
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={jest.fn()} onCancel={jest.fn()} />);

    const buttonNames = screen.getAllByRole('button').map((button) => button.textContent || '');
    expect(buttonNames.join(' ')).not.toMatch(/progress|understanding|mastery/i);
  });

  it('rejects a candidate whose prepared explanation is missing', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const missingExplanation = {
      ...preparedCandidate,
      assessment: { ...preparedCandidate.assessment!, learner_safe_explanation: '' },
    };
    render(<AssessmentDraftEditor decision={missingExplanation} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/explanation/i);
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['question', 'option A', 'option B', 'option C', 'option D', 'selection', 'key'] as const)(
    'retains validation feedback while editing %s until resubmission', async (field) => {
      const onSubmit = jest.fn();
      render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText('Question'), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('stem must not be blank');
      expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');

      if (field === 'question') {
        fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What should you check before paying?' } });
      } else if (field.startsWith('option ')) {
        const index = ['A', 'B', 'C', 'D'].indexOf(field.slice(-1));
        fireEvent.change(optionTextInputs()[index], { target: { value: `Revised option ${field.slice(-1)}.` } });
      } else if (field === 'selection') {
        fireEvent.change(screen.getByLabelText('Answer type'), { target: { value: 'multiple' } });
      } else if (field === 'key') {
        selectKey('C');
      }

      expect(screen.getByRole('alert')).toHaveTextContent('stem must not be blank');
      expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
      expect(onSubmit).not.toHaveBeenCalled();
    }
  );

  it('recalculates validation only after an explicit submission', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('stem must not be blank');

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'A corrected question asks what to verify.' } });
    expect(screen.getByRole('alert')).toHaveTextContent('stem must not be blank');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');

    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retains validation feedback until the corrected candidate is sent', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('stem must not be blank');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    fireEvent.change(screen.getByLabelText('Option A'), { target: { value: 'Revised first choice.' } });
    expect(screen.getByRole('alert')).toHaveTextContent('stem must not be blank');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'A corrected question asks what to verify.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['option A', 'option B', 'option C', 'option D', 'selection', 'key'] as const)(
    'allows direct sending after %s changes', async (field) => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const initialDecision = field === 'selection'
      ? { ...preparedCandidate, assessment: { ...preparedCandidate.assessment!, selection_type: 'multiple' as const, correct_option_ids: ['A', 'B'] as Array<'A' | 'B'> } }
      : preparedCandidate;
    render(<AssessmentDraftEditor decision={initialDecision} onSubmit={onSubmit} />);
    if (field.startsWith('option ')) {
      const optionIndex = ['A', 'B', 'C', 'D'].indexOf(field.slice(-1));
      fireEvent.change(optionTextInputs()[optionIndex], { target: { value: `Changed answer ${field.slice(-1)}.` } });
    } else if (field === 'selection') {
      fireEvent.change(screen.getByLabelText('Answer type'), { target: { value: 'single' } });
    } else {
      selectKey('C');
    }

    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    if (field === 'key') {
      const submitted = onSubmit.mock.calls[0][0] as TransferAssessmentDraft;
      expect(submitted.assessment!.correct_option_ids).toEqual(['C']);
    }
  });

  it('shows saving while the request is pending and the classified failure after rejection', async () => {
    let rejectSend: (error: Error) => void = () => undefined;
    const onSubmit = jest.fn().mockImplementation(() => new Promise<void>((_, reject) => {
      rejectSend = reject;
    }));
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    expect(await screen.findByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'saving');
    rejectSend(new Error('ASSESSMENT_ALREADY_OPEN'));
    expect(await screen.findByRole('alert')).toHaveTextContent('ASSESSMENT_ALREADY_OPEN');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'superseded');
  });

  it.each(['question', 'option A', 'option B', 'option C', 'option D', 'selection', 'key'] as const)(
    'clears a failed send when editing %s and allows a direct retry', async (field) => {
      const onSubmit = jest.fn()
        .mockRejectedValueOnce(new Error('ASSESSMENT_ALREADY_OPEN'))
        .mockResolvedValue(undefined);
      const initialDecision = field === 'selection'
        ? { ...preparedCandidate, assessment: { ...preparedCandidate.assessment!, selection_type: 'multiple' as const, correct_option_ids: ['A', 'B'] as Array<'A' | 'B'> } }
        : preparedCandidate;
      render(<AssessmentDraftEditor decision={initialDecision} onSubmit={onSubmit} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
      });
      expect(screen.getByRole('alert')).toHaveTextContent('ASSESSMENT_ALREADY_OPEN');
      expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'superseded');

      if (field === 'question') {
        fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What should you verify before paying?' } });
      } else if (field.startsWith('option ')) {
        const index = ['A', 'B', 'C', 'D'].indexOf(field.slice(-1));
        fireEvent.change(optionTextInputs()[index], { target: { value: `Revised option ${field.slice(-1)}.` } });
      } else if (field === 'selection') {
        fireEvent.change(screen.getByLabelText('Answer type'), { target: { value: 'single' } });
      } else if (field === 'key') {
        selectKey('C');
      }

      expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'dirty');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }
  );
});
