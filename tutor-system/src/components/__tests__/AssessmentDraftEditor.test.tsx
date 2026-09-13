#!/usr/bin/env node
/**
 * Test responsible for src/components/AssessmentDraftEditor.tsx: the structured teacher review
 * surface for a prepared transfer-assessment candidate.
 *
 * Responsibility: prove the approved room-themed editor renders editable options and a live answer
 * key, preserves the AI-selected format, validates content/key cardinality, sends in one action,
 * locks pending delivery, retains failed edits, exposes review state, and discards.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssessmentDraftEditor from '../AssessmentDraftEditor';
import { preparedCandidate } from '../../test-support/transferRoomFixtures';
import type { TutorDecisionV3 } from '../../types/assessment';

const optionInputs = (): HTMLInputElement[] =>
  Array.from(document.querySelectorAll('input[name="assessment-correct-option"]')) as HTMLInputElement[];

const optionTextInputs = (): HTMLTextAreaElement[] =>
  ['A', 'B', 'C', 'D'].map((id) => screen.getByRole('textbox', { name: `Option ${id}` }) as HTMLTextAreaElement);

const selectKey = (label: string) => {
  const ids = ['A', 'B', 'C', 'D'];
  fireEvent.click(optionInputs()[ids.indexOf(label)]);
};

const multipleCandidate = (correctOptionIds: ('A' | 'B' | 'C' | 'D')[] = ['B', 'C']): TutorDecisionV3 => ({
  ...preparedCandidate,
  assessment: {
    ...preparedCandidate.assessment!,
    selection_type: 'multiple',
    correct_option_ids: correctOptionIds,
    rendered_text: preparedCandidate.assessment!.rendered_text.replace('Choose one.', 'Select all that apply.'),
  },
});

describe('AssessmentDraftEditor', () => {
  it('renders the approved room-themed structure, four options, and AI-selected key', () => {
    const { container } = render(<AssessmentDraftEditor decision={preparedCandidate} itemLabel="Verify payment requests" onSubmit={jest.fn()} />);

    expect(container.querySelector('.assessment-draft-editor')).toBeInTheDocument();
    expect(container.querySelector('.assessment-draft-editor__body')).toBeInTheDocument();
    expect(container.querySelector('.assessment-draft-editor__footer')).toBeInTheDocument();
    expect(screen.getByText('Target: Verify payment requests')).toBeInTheDocument();
    expect(optionTextInputs().map((input) => input.value)).toEqual([
      'Pay the fee quickly.',
      'Stop and verify the offer through an official channel.',
      'Forward the offer to a friend.',
      'Reply with your bank details.',
    ]);
    expect(screen.queryByLabelText('Answer type')).not.toBeInTheDocument();
    expect(screen.queryByText('Learner preview')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Correct answer B' })).toBeChecked();
    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('Correct answer');
    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('B — Stop and verify the offer through an official channel.');
  });

  it('submits the edited decision with the single confirmed key', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'A caller asks for a release fee. What do you do first?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('stem must not be blank');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uses the AI-supplied multiple format and enforces its key cardinality', async () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={multipleCandidate(['B'])} onSubmit={onSubmit} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.queryByLabelText('Answer type')).not.toBeInTheDocument();
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

  it('sends edits directly without a separate acknowledgement', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'An edited stem asks for a first step.' } });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].assessment.stem).toBe('An edited stem asks for a first step.');
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

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers no control that writes progress', () => {
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={jest.fn()} onCancel={jest.fn()} />);

    const buttonNames = screen.getAllByRole('button').map((button) => button.textContent || '');
    expect(buttonNames.join(' ')).not.toMatch(/progress|understanding|mastery/i);
  });

  it('updates the dedicated correct-answer review when the key or option text changes', () => {
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Correct answer C' }));
    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('C — Forward the offer to a friend.');
    fireEvent.change(screen.getByLabelText('Option C'), { target: { value: 'Report it using the official channel.' } });
    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('C — Report it using the official channel.');
  });

  it('locks all editing and actions until a pending send completes', async () => {
    let finish!: () => void;
    const onSubmit = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onCancel = jest.fn();
    render(<AssessmentDraftEditor decision={multipleCandidate()} onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(screen.getByTestId('assessment-review-status')).toHaveTextContent('Sending assessment...');
    [...screen.getAllByRole('textbox'), ...screen.getAllByRole('checkbox'), ...screen.getAllByRole('button')]
      .forEach((control) => expect(control).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Sending...' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(screen.getByRole('button', { name: 'Send assessment' })).toBeEnabled();
  });

  it('preserves failed edits and sends the same payload on retry', async () => {
    const onSubmit = jest.fn().mockRejectedValueOnce(new Error('Delivery unavailable')).mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Option B'), { target: { value: 'Verify using the official app.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Delivery unavailable');
    expect(screen.getByLabelText('Option B')).toHaveValue('Verify using the official app.');
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toEqual(onSubmit.mock.calls[0][0]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects a blank option and a single-selection candidate without a key', () => {
    const onSubmit = jest.fn();
    const { rerender } = render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Option A'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(screen.getByRole('alert')).toHaveTextContent('non-empty text');
    const noKey = { ...preparedCandidate, assessment: { ...preparedCandidate.assessment!, correct_option_ids: [] } };
    rerender(<AssessmentDraftEditor decision={noKey} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose exactly one correct option.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lets the tutor revise an AI-supplied multiple answer key and preserves its type on send', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={multipleCandidate(['B', 'C'])} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Correct answer C' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Correct answer A' }));

    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('A — Pay the fee quickly.');
    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('B — Stop and verify the offer through an official channel.');
    expect(screen.getByTestId('assessment-answer-key')).not.toHaveTextContent('C — Forward the offer to a friend.');

    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].assessment.selection_type).toBe('multiple');
    expect(onSubmit.mock.calls[0][0].assessment.correct_option_ids).toEqual(['A', 'B']);
  });

  it('accepts three AI-supplied multiple answers without changing their type', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<AssessmentDraftEditor decision={multipleCandidate(['A', 'B', 'C'])} onSubmit={onSubmit} />);

    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('A — Pay the fee quickly.');
    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('B — Stop and verify the offer through an official channel.');
    expect(screen.getByTestId('assessment-answer-key')).toHaveTextContent('C — Forward the offer to a friend.');
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].assessment).toMatchObject({
      selection_type: 'multiple',
      correct_option_ids: ['A', 'B', 'C'],
    });
  });

  it('rejects an AI-supplied multiple candidate with four correct answers', () => {
    const onSubmit = jest.fn();
    render(<AssessmentDraftEditor decision={multipleCandidate(['A', 'B', 'C', 'D'])} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose two or three correct options.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('resets edited content, errors, and status when the candidate changes', () => {
    const { rerender } = render(<AssessmentDraftEditor decision={preparedCandidate} onSubmit={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const next = { ...preparedCandidate, assessment: { ...preparedCandidate.assessment!, stem: 'A caller requests a fee. What is safest?' } };
    rerender(<AssessmentDraftEditor decision={next} onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('Question')).toHaveValue(next.assessment.stem);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('assessment-review-status')).toHaveTextContent('Ready to send');
  });
});
