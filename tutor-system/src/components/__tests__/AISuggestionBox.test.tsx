#!/usr/bin/env node
/**
 * Test responsible for AISuggestionBox.tsx showing readable Quick Adjust labels, preserving internal parameter values, and preventing student-locked role changes.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AISuggestionBox from '../AISuggestionBox';
import { getConfigurationPreset } from '../../services/prompts/parameterConfig';

describe('AISuggestionBox', () => {
    it('shows readable Quick Adjust labels while regenerating with internal parameter values', () => {
        const onRegenerate = jest.fn();
        const { container } = render(
            <AISuggestionBox
                suggestion="Try asking about the sender domain."
                onCopy={jest.fn()}
                onReject={jest.fn()}
                onRegenerate={onRegenerate}
                isVisible={true}
                parameterConfig={getConfigurationPreset('standard')}
                initialParameters={{ role: { role: 'high' } }}
            />
        );

        fireEvent.click(screen.getByText('Quick Adjust'));

        expect(screen.getByText('Communication Style')).toBeInTheDocument();
        expect(screen.getByText('Teen Slang:')).toBeInTheDocument();
        expect(screen.getByText('Cognitive Parameters')).toBeInTheDocument();
        expect(screen.getByText('Emotional Parameters')).toBeInTheDocument();
        const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
        expect(within(selects[0]).getByRole('option', { name: 'Trusted Adult' })).toHaveProperty('selected', true);
        expect(within(selects[0]).getByRole('option', { name: 'Peer' })).toHaveValue('low');
        expect(within(selects[1]).getByRole('option', { name: 'Casual' })).toHaveValue('high');
        expect(Array.from(container.querySelectorAll('.ai-parameter-section-title, .ai-parameter-label, option'))
            .every(element => !element.textContent?.includes('_'))).toBe(true);

        fireEvent.change(selects[0], { target: { value: 'low' } });
        fireEvent.change(selects[1], { target: { value: 'low' } });
        fireEvent.click(screen.getByText('Regenerate'));
        expect(onRegenerate).toHaveBeenCalledWith(expect.objectContaining({
            role: { role: 'low' },
            communication_style: expect.objectContaining({ teen_slang: 'low' })
        }));

        fireEvent.click(screen.getByTitle('View detailed information about Communication Style'));
        expect(screen.getByRole('heading', { name: 'Communication Style Parameters' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Teen Slang' })).toBeInTheDocument();
    });

    it.each(['low', 'high'] as const)('disables the student-locked %s role and regenerates with that role', lockedRole => {
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
                initialParameters={{ role: { role: lockedRole === 'low' ? 'high' : 'low' } }}
                lockedRole={lockedRole}
            />
        );

        fireEvent.click(screen.getByText('Quick Adjust'));

        const roleSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
        expect(roleSelect).toHaveValue(lockedRole);
        expect(roleSelect).toBeDisabled();
        expect(roleSelect.selectedOptions[0]).toHaveTextContent(lockedRole === 'low' ? 'Peer' : 'Trusted Adult');

        fireEvent.click(screen.getByText('Regenerate'));

        expect(onRegenerate).toHaveBeenCalledWith(
            expect.objectContaining({ role: { role: lockedRole } })
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
