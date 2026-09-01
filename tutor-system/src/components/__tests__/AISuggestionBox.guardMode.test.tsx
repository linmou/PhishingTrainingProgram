#!/usr/bin/env node
/**
 * Test responsible for tutor-only Guard review controls and independent final wording/mode editing.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AISuggestionBox from '../AISuggestionBox';

describe('AISuggestionBox Guard Mode review', () => {
    it('shows the raw mode reason and lets the tutor rectify mode without changing wording', () => {
        const onFinalModeChange = jest.fn();
        const onFinalResponseChange = jest.fn();

        render(
            <AISuggestionBox
                suggestion="Stop and verify the destination."
                decision={{
                    mode: 'guard',
                    mode_reason: 'The student deliberately repeated the unsafe action.',
                    suggested_response: 'Stop and verify the destination.'
                }}
                finalMode="guard"
                onFinalModeChange={onFinalModeChange}
                onFinalResponseChange={onFinalResponseChange}
                onCopy={jest.fn()}
                onReject={jest.fn()}
                isVisible={true}
            />
        );

        expect(screen.getByText('Guard Mode Activated')).toBeInTheDocument();
        expect(screen.getByText(/deliberately repeated/)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Final response mode'), { target: { value: 'tutoring' } });
        expect(onFinalModeChange).toHaveBeenCalledWith('tutoring');

        fireEvent.change(screen.getByLabelText('Final tutor response'), { target: { value: 'Edited response.' } });
        expect(onFinalResponseChange).toHaveBeenCalledWith('Edited response.');
    });

    it('shows rectification and wording-change state from the review values', () => {
        render(
            <AISuggestionBox
                suggestion="A tutor-edited response."
                decision={{
                    mode: 'guard',
                    mode_reason: 'The student deliberately repeated the unsafe action.',
                    suggested_response: 'The raw AI response.'
                }}
                finalMode="tutoring"
                onCopy={jest.fn()}
                onReject={jest.fn()}
                isVisible={true}
            />
        );

        expect(screen.getByText('Mode rectified by tutor')).toBeInTheDocument();
        expect(screen.getByText('Wording modified by tutor')).toBeInTheDocument();
        expect(screen.queryByText('Guard Mode Activated')).not.toBeInTheDocument();
    });
});
