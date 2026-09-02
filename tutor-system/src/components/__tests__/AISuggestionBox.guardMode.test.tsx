#!/usr/bin/env node
/**
 * Test responsible for Guard AI suggestions remaining display-only in the tutor UI.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AISuggestionBox from '../AISuggestionBox';

describe('AISuggestionBox Guard Mode display', () => {
    const renderSuggestion = () => render(
        <AISuggestionBox
            suggestion="Stop and verify the destination."
            onCopy={jest.fn()}
            onReject={jest.fn()}
            isVisible={true}
        />
    );

    it('shows generated text without an editor', () => {
        renderSuggestion();

        expect(screen.getByText('Stop and verify the destination.')).toBeInTheDocument();
        expect(screen.queryByLabelText('Final tutor response')).not.toBeInTheDocument();
    });

    it('hides internal AI review controls', () => {
        renderSuggestion();

        expect(screen.queryByText('AI review')).not.toBeInTheDocument();
        expect(screen.queryByText('Review before sending')).not.toBeInTheDocument();
        expect(screen.queryByText('Guard Mode Activated')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Final response mode')).not.toBeInTheDocument();
    });

    it('places an Activate Guard button above Quick Adjust and invokes its handler', () => {
        const onToggleGuard = jest.fn();

        render(
            <AISuggestionBox
                suggestion="Stop and verify the destination."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onToggleGuard={onToggleGuard}
                isGuardMode={false}
                isVisible={true}
            />
        );

        const suggestionCard = screen.getByText('Stop and verify the destination.').closest('.ai-suggestion-box');
        expect(suggestionCard).not.toBeNull();

        const guardButton = within(suggestionCard as HTMLElement).getByRole('button', { name: 'Activate Guard' });
        const quickAdjust = within(suggestionCard as HTMLElement).getByText('Quick Adjust');
        const guardToggle = guardButton.closest('.ai-guard-toggle');
        const quickAdjustSection = quickAdjust.closest('.ai-suggestion-parameters');

        expect(guardToggle).not.toBeNull();
        expect(quickAdjustSection).not.toBeNull();
        expect(guardToggle?.nextElementSibling).toBe(quickAdjustSection);
        fireEvent.click(guardButton);
        expect(onToggleGuard).toHaveBeenCalledTimes(1);
    });

    it('labels the card control Deactivate Guard when Guard is active', () => {
        render(
            <AISuggestionBox
                suggestion="Stop and verify the destination."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onToggleGuard={jest.fn()}
                isGuardMode={true}
                isVisible={true}
            />
        );

        expect(screen.getByRole('button', { name: 'Deactivate Guard' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Activate Guard' })).not.toBeInTheDocument();
    });
});
