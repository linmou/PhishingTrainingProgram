#!/usr/bin/env node
/**
 * Test responsible for AIAssistantSettings.tsx reflecting the effective aiConfig in the settings form after Quick Adjust or saved modular changes.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIAssistantSettings from '../AIAssistantSettings';
import { useRoom } from '../../contexts/RoomContext';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/RoomContext', () => ({
    useRoom: jest.fn()
}));

jest.mock('../../contexts/AuthContext', () => ({
    useAuth: jest.fn()
}));

describe('AIAssistantSettings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('hydrates modular controls from aiConfig prompt_config instead of default values', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            user: {
                id: 'tutor-1',
                current_role: 'tutor'
            }
        });

        (useRoom as jest.Mock).mockReturnValue({
            currentRoom: {
                id: 'room-1',
                ai_assistant_enabled: true
            },
            aiConfig: {
                id: 'room-1',
                room_id: 'room-1',
                model_name: 'gpt-4o',
                system_prompt: 'Updated quick-adjust prompt',
                prompt_config: {
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
                    },
                    detection_areas: ['Suspicious links', 'Sender spoofing'],
                    verification_steps: ['Check sender', 'Hover over links']
                },
                temperature: 0.4,
                max_tokens: 120,
                is_active: true,
                created_at: '2026-03-20T00:00:00Z',
                updated_at: '2026-03-26T12:00:00Z'
            },
            toggleAIAssistant: jest.fn(),
            loadingAI: false
        });

        render(<AIAssistantSettings onClose={jest.fn()} />);

        expect(screen.getByLabelText('Enable AI Assistant')).toBeChecked();
        expect(screen.getByLabelText('Use Phishing Training Templates')).toBeChecked();
        expect(screen.getByDisplayValue('Casual Peer - Fellow learner, relatable language')).toBeInTheDocument();

        await waitFor(() => {
            expect(
                screen.getByPlaceholderText('Red flags to watch for (optional - will use template if empty)')
            ).toHaveValue('Suspicious links\nSender spoofing');
            expect(
                screen.getByPlaceholderText('Steps students should take to verify content (optional)')
            ).toHaveValue('Check sender\nHover over links');
        });

        expect(screen.getByText(/Temperature: 0.4/)).toBeInTheDocument();
        expect(screen.getByText(/Max Response Length: 120 tokens/)).toBeInTheDocument();
    });
});
