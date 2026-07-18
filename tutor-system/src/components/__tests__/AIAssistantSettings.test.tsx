#!/usr/bin/env node
/**
 * Test responsible for AIAssistantSettings.tsx reflecting the effective aiConfig in the settings form after Quick Adjust or saved modular changes.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIAssistantSettings from '../AIAssistantSettings';
import { useRoom } from '../../contexts/RoomContext';
import { useAuth } from '../../contexts/AuthContext';
import { SCENARIO_TEMPLATES } from '../../services/detectionTemplates';
import { generateSystemPrompt } from '../../services/systemPrompts';

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
                model_name: 'gpt-4o-mini',
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

    it('shows the saved scenario instead of falling back to Custom / General when prompt_config matches a template', async () => {
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
                model_name: 'gpt-4o-mini',
                system_prompt: 'Scenario-backed prompt',
                prompt_config: {
                    role: { role: 'high' },
                    communication_style: {
                        teen_slang: 'low',
                        conversational_markers: 'low',
                        uncertainty_expression: 'low'
                    },
                    cognitive_parameters: {
                        concept_density: 'high',
                        perspective_taking: 'high',
                        personal_examples: 'high',
                        consequence_highlighting: 'high'
                    },
                    emotional_parameters: {
                        enthusiasm_level: 'low',
                        validation_frequency: 'high',
                        mistake_normalization: 'high',
                        confidence_building: 'high'
                    },
                    detection_areas: SCENARIO_TEMPLATES['General Scam Indicators'].detection_areas,
                    verification_steps: SCENARIO_TEMPLATES['General Scam Indicators'].verification_steps
                },
                temperature: 0.7,
                max_tokens: 150,
                is_active: true,
                created_at: '2026-03-20T00:00:00Z',
                updated_at: '2026-03-26T12:00:00Z'
            },
            toggleAIAssistant: jest.fn(),
            loadingAI: false
        });

        render(<AIAssistantSettings onClose={jest.fn()} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('General Scam Indicators')).toBeInTheDocument();
        });
    });

    it('persists the selected scenario template when saving without custom textarea overrides', async () => {
        const toggleAIAssistant = jest.fn().mockResolvedValue(undefined);

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
                model_name: 'gpt-4o-mini',
                system_prompt: 'Original prompt',
                prompt_config: null,
                temperature: 0.7,
                max_tokens: 150,
                is_active: true,
                created_at: '2026-03-20T00:00:00Z',
                updated_at: '2026-03-26T12:00:00Z'
            },
            toggleAIAssistant,
            loadingAI: false
        });

        render(<AIAssistantSettings onClose={jest.fn()} />);

        fireEvent.click(screen.getByLabelText('Use Phishing Training Templates'));
        fireEvent.change(screen.getByDisplayValue('Custom / General'), {
            target: { value: 'Location Sharing Risks' }
        });
        fireEvent.click(screen.getByText('Save Settings'));

        await waitFor(() => {
            expect(toggleAIAssistant).toHaveBeenCalledWith(
                true,
                expect.objectContaining({
                    prompt_config: expect.objectContaining({
                        detection_areas: SCENARIO_TEMPLATES['Location Sharing Risks'].detection_areas,
                        verification_steps: SCENARIO_TEMPLATES['Location Sharing Risks'].verification_steps
                    }),
                    system_prompt: generateSystemPrompt({
                        role: { role: 'high' },
                        communication_style: {
                            teen_slang: 'low',
                            conversational_markers: 'low',
                            uncertainty_expression: 'low'
                        },
                        cognitive_parameters: {
                            concept_density: 'high',
                            perspective_taking: 'high',
                            personal_examples: 'high',
                            consequence_highlighting: 'high'
                        },
                        emotional_parameters: {
                            enthusiasm_level: 'low',
                            validation_frequency: 'high',
                            mistake_normalization: 'high',
                            confidence_building: 'high'
                        },
                        detection_areas: SCENARIO_TEMPLATES['Location Sharing Risks'].detection_areas,
                        verification_steps: SCENARIO_TEMPLATES['Location Sharing Risks'].verification_steps
                    })
                })
            );
        });
    });

    it('replaces prior template-derived checklist fields when switching to a different scenario template', async () => {
        const toggleAIAssistant = jest.fn().mockResolvedValue(undefined);

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
                model_name: 'gpt-4o-mini',
                system_prompt: generateSystemPrompt({
                    role: { role: 'high' },
                    communication_style: {
                        teen_slang: 'low',
                        conversational_markers: 'low',
                        uncertainty_expression: 'low'
                    },
                    cognitive_parameters: {
                        concept_density: 'high',
                        perspective_taking: 'high',
                        personal_examples: 'high',
                        consequence_highlighting: 'high'
                    },
                    emotional_parameters: {
                        enthusiasm_level: 'low',
                        validation_frequency: 'high',
                        mistake_normalization: 'high',
                        confidence_building: 'high'
                    },
                    detection_areas: SCENARIO_TEMPLATES['Location Sharing Risks'].detection_areas,
                    verification_steps: SCENARIO_TEMPLATES['Location Sharing Risks'].verification_steps
                }),
                prompt_config: {
                    role: { role: 'high' },
                    communication_style: {
                        teen_slang: 'low',
                        conversational_markers: 'low',
                        uncertainty_expression: 'low'
                    },
                    cognitive_parameters: {
                        concept_density: 'high',
                        perspective_taking: 'high',
                        personal_examples: 'high',
                        consequence_highlighting: 'high'
                    },
                    emotional_parameters: {
                        enthusiasm_level: 'low',
                        validation_frequency: 'high',
                        mistake_normalization: 'high',
                        confidence_building: 'high'
                    },
                    detection_areas: SCENARIO_TEMPLATES['Location Sharing Risks'].detection_areas,
                    verification_steps: SCENARIO_TEMPLATES['Location Sharing Risks'].verification_steps
                },
                temperature: 0.7,
                max_tokens: 150,
                is_active: true,
                created_at: '2026-03-20T00:00:00Z',
                updated_at: '2026-03-26T12:00:00Z'
            },
            toggleAIAssistant,
            loadingAI: false
        });

        render(<AIAssistantSettings onClose={jest.fn()} />);

        fireEvent.change(screen.getByDisplayValue('Location Sharing Risks'), {
            target: { value: 'Contact Information Exposure' }
        });
        fireEvent.click(screen.getByText('Save Settings'));

        await waitFor(() => {
            expect(toggleAIAssistant).toHaveBeenCalledWith(
                true,
                expect.objectContaining({
                    prompt_config: expect.objectContaining({
                        detection_areas: SCENARIO_TEMPLATES['Contact Information Exposure'].detection_areas,
                        verification_steps: SCENARIO_TEMPLATES['Contact Information Exposure'].verification_steps
                    })
                })
            );
        });
    });

    it('locks AI Personality when student_tone_lock is set and shows lock indicator', async () => {
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
                model_name: 'gpt-4o-mini',
                system_prompt: 'peer prompt',
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
                        enthusiasm_level: 'low',
                        validation_frequency: 'low',
                        mistake_normalization: 'high',
                        confidence_building: 'high'
                    },
                    detection_areas: ['Suspicious links'],
                    verification_steps: ['Check sender'],
                    student_tone_lock: {
                        locked: true,
                        chosen_by_user_id: 'student-1',
                        chosen_role: 'low'
                    }
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

        const personality = screen.getByRole('combobox', { name: /AI Personality/i });
        expect(personality).toBeDisabled();
        expect(screen.getByTestId('ai-tone-lock-indicator')).toBeInTheDocument();
        expect(screen.getByText(/student chose/i)).toBeInTheDocument();
    });

    it('keeps AI Personality editable when student has not locked tone', () => {
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
                model_name: 'gpt-4o-mini',
                system_prompt: 'prompt',
                prompt_config: {
                    role: { role: 'high' },
                    communication_style: {
                        teen_slang: 'low',
                        conversational_markers: 'low',
                        uncertainty_expression: 'low'
                    },
                    cognitive_parameters: {
                        concept_density: 'low',
                        perspective_taking: 'low',
                        personal_examples: 'low',
                        consequence_highlighting: 'low'
                    },
                    emotional_parameters: {
                        enthusiasm_level: 'low',
                        validation_frequency: 'low',
                        mistake_normalization: 'low',
                        confidence_building: 'low'
                    },
                    detection_areas: [],
                    verification_steps: []
                },
                temperature: 0.7,
                max_tokens: 150,
                is_active: true,
                created_at: '2026-03-20T00:00:00Z',
                updated_at: '2026-03-26T12:00:00Z'
            },
            toggleAIAssistant: jest.fn(),
            loadingAI: false
        });

        render(<AIAssistantSettings onClose={jest.fn()} />);

        const personality = screen.getByRole('combobox', { name: /AI Personality/i });
        expect(personality).not.toBeDisabled();
        expect(screen.queryByTestId('ai-tone-lock-indicator')).not.toBeInTheDocument();
    });
});
