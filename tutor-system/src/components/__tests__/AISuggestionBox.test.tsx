#!/usr/bin/env node
/**
 * Test responsible for AISuggestionBox.tsx showing Quick Adjust selectors from the current aiConfig and preventing a student-locked AI role from changing.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AISuggestionBox from '../AISuggestionBox';
import { getConfigurationPreset } from '../../services/prompts/parameterConfig';

describe('AISuggestionBox', () => {
    it('disables the student-locked role and regenerates with that role', () => {
        const onRegenerate = jest.fn();
        const LockedAISuggestionBox = AISuggestionBox as React.ComponentType<any>;

        render(
            <LockedAISuggestionBox
                suggestion="Try asking about the sender domain."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onRegenerate={onRegenerate}
                isVisible={true}
                isRegenerating={false}
                parameterConfig={getConfigurationPreset('standard')}
                initialParameters={{ role: { role: 'high' } }}
                lockedRole="low"
            />
        );

        fireEvent.click(screen.getByText('Quick Adjust'));

        const roleSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
        expect(roleSelect).toHaveValue('low');
        expect(roleSelect).toBeDisabled();

        fireEvent.click(screen.getByText('Regenerate'));

        expect(onRegenerate).toHaveBeenCalledWith(
            expect.objectContaining({ role: { role: 'low' } })
        );
    });

    it('keeps the Quick Adjust role editable when no student role is locked', () => {
        render(
            <AISuggestionBox
                suggestion="Try asking about the sender domain."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onRegenerate={jest.fn()}
                isVisible={true}
                isRegenerating={false}
                parameterConfig={getConfigurationPreset('standard')}
                initialParameters={{ role: { role: 'low' } }}
            />
        );

        fireEvent.click(screen.getByText('Quick Adjust'));
        const roleSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;

        expect(roleSelect).not.toBeDisabled();
        fireEvent.change(roleSelect, { target: { value: 'high' } });
        expect(roleSelect).toHaveValue('high');
    });

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

    it('preserves a tutor dropdown selection across parent rerenders with equivalent props', () => {
        const onRegenerate = jest.fn();
        const initialParameters = {
            role: { role: 'low' as const },
            communication_style: {
                teen_slang: 'high' as const,
                conversational_markers: 'high' as const,
                uncertainty_expression: 'low' as const
            }
        };

        const { container, rerender } = render(
            <AISuggestionBox
                suggestion="Try asking about the sender domain."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onRegenerate={onRegenerate}
                isVisible={true}
                isRegenerating={false}
                parameterConfig={getConfigurationPreset('standard')}
                initialParameters={initialParameters}
            />
        );

        fireEvent.click(screen.getByText('Quick Adjust'));

        const selects = Array.from(container.querySelectorAll('select'));
        const teenSlangSelect = selects[1] as HTMLSelectElement;

        expect(teenSlangSelect.value).toBe('high');

        fireEvent.change(teenSlangSelect, { target: { value: 'low' } });
        expect(teenSlangSelect.value).toBe('low');

        rerender(
            <AISuggestionBox
                suggestion="Try asking about the sender domain."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onRegenerate={onRegenerate}
                isVisible={true}
                isRegenerating={false}
                parameterConfig={getConfigurationPreset('standard')}
                initialParameters={{
                    role: { role: 'low' },
                    communication_style: {
                        teen_slang: 'high',
                        conversational_markers: 'high',
                        uncertainty_expression: 'low'
                    }
                }}
            />
        );

        fireEvent.click(screen.getByText('Regenerate'));

        expect(onRegenerate).toHaveBeenCalledWith(
            expect.objectContaining({
                role: { role: 'low' },
                communication_style: expect.objectContaining({
                    teen_slang: 'low'
                })
            })
        );
    });
});
