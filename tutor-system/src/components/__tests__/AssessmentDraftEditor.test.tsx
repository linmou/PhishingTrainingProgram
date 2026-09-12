#!/usr/bin/env node
/**
 * Test responsible for src/components/AssessmentDraftEditor.tsx: the structured teacher review
 * surface for a prepared transfer-assessment candidate.
 *
 * Responsibility: prove the editor renders the four ordered options and learner preview, enforces
 * key cardinality and content validation through the production validator, clears confirmation on
 * every edit, exposes its own review state, can discard the candidate without persisting anything,
 * and offers no direct progress control.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    render(<AssessmentDraftEditor decision={preparedCandidate} itemLabel="Verify payment requests" onSubmit={jest.fn()} />);

    expect(screen.getByText('Target: Verify payment requests')).toBeInTheDocument();
    expect(optionTextInputs().map((input) => input.value)).toEqual([
      'Pay the fee quickly.',
      'Stop and verify the offer through an official channel.',
      'Forward the offer to a friend.',
      'Reply with your bank details.',
    ]);
    expect(screen.getByText(/Choose one\./)).toBeInTheDocument();
    expect(screen.getByText(/Stop and verify the offer through an official channel\./)).toBeInTheDocument();
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
});
