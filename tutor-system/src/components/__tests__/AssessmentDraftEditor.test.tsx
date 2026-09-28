#!/usr/bin/env node
/**
 * Test responsible for src/components/AssessmentDraftEditor.tsx: the structured teacher review
 * surface for a prepared transfer-assessment candidate.
 *
 * Responsibility: prove the editor renders the four ordered options and learner preview, enforces
 * key cardinality and content validation through the production validator, clears confirmation on
 * every edit including learner-safe explanation, exposes its own review states, can discard without persisting anything,
 * and offers no direct progress control.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssessmentDraftEditor from '../AssessmentDraftEditor';
import { preparedCandidate } from '../../test-support/transferRoomFixtures';
import type { TutorDecisionV3 } from '../../types/assessment';

const optionInputs = (): HTMLInputElement[] =>
  Array.from(document.querySelectorAll('input[name="assessment-correct-option"]')) as HTMLInputElement[];

const optionTextInputs = (): HTMLInputElement[] =>
  Array.from(document.querySelectorAll('fieldset label input:not([name="assessment-correct-option"])')) as HTMLInputElement[];

const selectKey = (label: string) => {
  const ids = ['A', 'B', 'C', 'D'];
  fireEvent.click(optionInputs()[ids.indexOf(label)]);
};

describe('AssessmentDraftEditor', () => {
  it('renders the target, four ordered options, and the learner-visible preview', () => {
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
    const preview = container.querySelector('.assessment-draft-editor__preview');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveTextContent(/Choose one\./);
    expect(preview).toHaveTextContent(/Stop and verify the offer through an official channel\./);
  });

  it('submits the edited decision with the single confirmed key', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'A caller asks for a release fee. What do you do first?' } });
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0] as TutorDecisionV3;
    expect(submitted.response).toBe('A caller asks for a release fee. What do you do first?');
    expect(submitted.decision).toEqual({ mode: 'assessment', instruction: 'transfer_assess', target_item_id: preparedCandidate.decision.target_item_id });
    expect(submitted.assessment!.correct_option_ids).toEqual(['B']);
  });

  it('refuses a blank stem through the production rendering validator', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('stem must not be blank');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires two or three keys for a multiple-selection question', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    // The candidate has a single key, so switching to multiple leaves an invalid cardinality.
    fireEvent.change(screen.getByLabelText('Answer type'), { target: { value: 'multiple' } });
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));

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

  it('clears confirmation on every edit and requires it again before sending', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    expect(screen.getByLabelText(/I confirm the concept/)).toBeChecked();

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'An edited stem asks for a first step.' } });

    expect(screen.getByLabelText(/I confirm the concept/)).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm that the concept, changed context, and answer key are appropriate.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reports its own review state, including unsaved edits', () => {
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={jest.fn()} />);

    const status = screen.getByTestId('assessment-review-status');
    expect(status).toHaveAttribute('data-review-status', 'ready');

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'An edited stem asks for a first step.' } });

    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'dirty');
    expect(screen.getByTestId('assessment-review-status')).toHaveTextContent('Unsaved edits');
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

  it('requires reconfirmation after editing the learner-safe explanation and sends the edited value', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    const explanation = screen.getByLabelText('Learner-safe explanation') as HTMLTextAreaElement;
    expect(explanation.value).toBe(preparedCandidate.assessment!.learner_safe_explanation);
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.change(explanation, { target: { value: '  Verify through an official channel first.  ' } });

    expect(screen.getByLabelText(/I confirm the concept/)).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm that the concept');
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that the concept');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].assessment).toMatchObject({
      stem: preparedCandidate.assessment!.stem,
      options: preparedCandidate.assessment!.options,
      learner_safe_explanation: 'Verify through an official channel first.',
      selection_type: 'single',
      correct_option_ids: ['B'],
    });
  });

  it('rejects a blank learner-safe explanation after reconfirmation', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('learner-safe explanation');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['question', 'option A', 'option B', 'option C', 'option D', 'selection', 'key', 'explanation'] as const)(
    'retains validation feedback while editing %s until resubmission', async (field) => {
      const onSubmit = jest.fn();
      render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: '   ' } });
      fireEvent.click(screen.getByLabelText(/I confirm the concept/));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('learner-safe explanation');
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
      } else {
        fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: 'Verify through an official channel.' } });
      }

      expect(screen.getByRole('alert')).toHaveTextContent('learner-safe explanation');
      expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
      expect(screen.getByLabelText(/I confirm the concept/)).not.toBeChecked();
      expect(onSubmit).not.toHaveBeenCalled();
    }
  );

  it('recalculates validation only after an explicit submission', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('learner-safe explanation');

    fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: 'Verify through an official channel.' } });
    expect(screen.getByRole('alert')).toHaveTextContent('learner-safe explanation');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that the concept');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('retains validation feedback through confirmation toggles until an explicit send', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('learner-safe explanation');

    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    expect(screen.getByRole('alert')).toHaveTextContent('learner-safe explanation');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    expect(screen.getByRole('alert')).toHaveTextContent('learner-safe explanation');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'validating');
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: 'Verify through an official channel.' } });
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    expect(screen.getByRole('alert')).toHaveTextContent('learner-safe explanation');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['option A', 'option B', 'option C', 'option D', 'selection', 'key'] as const)(
    'refuses an unreconfirmed send when %s changes', async (field) => {
    const onSubmit = jest.fn();
    const initialDecision = field === 'selection'
      ? { ...preparedCandidate, assessment: { ...preparedCandidate.assessment!, selection_type: 'multiple' as const, correct_option_ids: ['A', 'B'] as Array<'A' | 'B'> } }
      : preparedCandidate;
    render(<AssessmentDraftEditor decision={initialDecision} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));

    if (field.startsWith('option ')) {
      const optionIndex = ['A', 'B', 'C', 'D'].indexOf(field.slice(-1));
      fireEvent.change(optionTextInputs()[optionIndex], { target: { value: `Changed answer ${field.slice(-1)}.` } });
    } else if (field === 'selection') {
      fireEvent.change(screen.getByLabelText('Answer type'), { target: { value: 'single' } });
    } else {
      selectKey('C');
    }

    expect(screen.getByLabelText(/I confirm the concept/)).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm that the concept');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows saving while the request is pending and the classified failure after rejection', async () => {
    let rejectSend: (error: Error) => void = () => undefined;
    const onSubmit = jest.fn().mockImplementation(() => new Promise<void>((_, reject) => {
      rejectSend = reject;
    }));
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText(/I confirm the concept/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));

    expect(await screen.findByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'saving');
    rejectSend(new Error('ASSESSMENT_ALREADY_OPEN'));
    expect(await screen.findByRole('alert')).toHaveTextContent('ASSESSMENT_ALREADY_OPEN');
    expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'superseded');
  });

  it.each(['question', 'option A', 'option B', 'option C', 'option D', 'selection', 'key', 'explanation'] as const)(
    'clears a failed send when editing %s and requires a new confirmation', async (field) => {
      const onSubmit = jest.fn()
        .mockRejectedValueOnce(new Error('ASSESSMENT_ALREADY_OPEN'))
        .mockResolvedValue(undefined);
      const initialDecision = field === 'selection'
        ? { ...preparedCandidate, assessment: { ...preparedCandidate.assessment!, selection_type: 'multiple' as const, correct_option_ids: ['A', 'B'] as Array<'A' | 'B'> } }
        : preparedCandidate;
      render(<AssessmentDraftEditor decision={initialDecision} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByLabelText(/I confirm the concept/));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
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
      } else {
        fireEvent.change(screen.getByLabelText('Learner-safe explanation'), { target: { value: 'Check with the official source.' } });
      }

      expect(screen.getByTestId('assessment-review-status')).toHaveAttribute('data-review-status', 'dirty');
      expect(screen.getByLabelText(/I confirm the concept/)).not.toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText(/I confirm the concept/));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm assessment' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    }
  );
});
