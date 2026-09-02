#!/usr/bin/env node
/**
 * Test responsible for Guard AI suggestions remaining display-only in the tutor UI.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
