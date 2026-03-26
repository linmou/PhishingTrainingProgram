#!/usr/bin/env node
/**
 * Test responsible for AISuggestionBox.tsx showing Quick Adjust selectors from the current aiConfig instead of resetting to defaults.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AISuggestionBox from '../AISuggestionBox';
import { getConfigurationPreset } from '../../services/prompts/parameterConfig';

describe('AISuggestionBox', () => {
    it('initializes Quick Adjust selectors from initialParameters', () => {
        const { container } = render(
            <AISuggestionBox
                suggestion="Try asking about the sender domain."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onRegenerate={jest.fn()}
                isVisible={true}
                isRegenerating={false}
                parameterConfig={getConfigurationPreset('standard')}
                initialParameters={{
                    role: { role: 'low' },
                    communication_style: {
                        teen_slang: 'high',
                        conversational_markers: 'high',
                        uncertainty_expression: 'low'
                    },
                    cognitive_parameters: {
                        concept_density: 'low',
                        perspective_taking: 'high',
                        personal_examples: 'low',
                        consequence_highlighting: 'high'
                    },
                    emotional_parameters: {
                        enthusiasm_level: 'high',
                        validation_frequency: 'high',
                        mistake_normalization: 'low',
                        confidence_building: 'high'
                    }
                }}
            />
        );

        fireEvent.click(screen.getByText('Quick Adjust'));

        const selects = Array.from(container.querySelectorAll('select'));
        const selectValues = selects.map(select => (select as HTMLSelectElement).value);

        expect(selectValues).toContain('high');
        expect(selectValues).toContain('low');
        expect(selectValues[0]).toBe('low');
        expect(selectValues[1]).toBe('high');
        expect(selectValues[2]).toBe('high');
        expect(selectValues[3]).toBe('low');
    });
});
