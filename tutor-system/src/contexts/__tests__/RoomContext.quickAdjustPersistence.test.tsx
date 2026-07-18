#!/usr/bin/env node
/**
 * Test responsible for RoomContext.tsx persisting Quick Adjust AI config changes after a tutor regenerates a suggestion.
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { generateTutorSuggestion, updateAIConfig, getAIConfig } from '../../services/aiService';
import { AIAssistantConfigSnapshot, Room, User } from '../../types';

jest.mock('../../services/supabase', () => ({
    supabase: {
        channel: jest.fn(),
        from: jest.fn(),
        storage: {
            from: jest.fn()
        }
    },
    validateRoomPassword: jest.fn(),
    submitMessageFeedback: jest.fn(),
    getMessageFeedbackStats: jest.fn(),
    getUserMessageFeedback: jest.fn(),
    getRoomFeedbackSummary: jest.fn(),
    clearChatHistory: jest.fn()
}));

jest.mock('../../services/aiService', () => ({
    generateTutorSuggestion: jest.fn(),
    recordAISuggestionFeedback: jest.fn(),
    updateAIConfig: jest.fn(),
    getAIConfig: jest.fn()
}));

jest.mock('../AuthContext', () => ({
    useAuth: jest.fn()
}));

const TestRoomHelper: React.FC<{ onReady: (roomApi: ReturnType<typeof useRoom>) => void }> = ({ onReady }) => {
    const roomApi = useRoom();

    React.useEffect(() => {
        onReady(roomApi);
    }, [onReady, roomApi]);

    return null;
};

describe('RoomContext Quick Adjust persistence', () => {
    const mockUser: User = {
        id: 'tutor-1',
        email: 'tutor@example.com',
        display_name: 'Tutor',
        current_role: 'tutor',
        status: 'active',
        created_at: '2026-03-20T00:00:00Z',
        updated_at: '2026-03-26T00:00:00Z'
    };

    const mockRoom: Room = {
        id: 'room-1',
        tutor_id: 'tutor-1',
        title: 'Room',
        description: 'Test room',
        image_url: null,
        is_active: true,
        ai_assistant_enabled: true,
        ai_assistant_model: 'gpt-4o-mini',
        ai_assistant_prompt: 'Original prompt',
        op_id: null,
        op_display_name: null,
        op_avatar_url: null,
        password: null,
        created_at: '2026-03-20T00:00:00Z',
        updated_at: '2026-03-26T00:00:00Z'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        (useAuth as jest.Mock).mockReturnValue({
            user: mockUser,
            loading: false
        });

        (getAIConfig as jest.Mock).mockResolvedValue(null);

        (supabase.channel as jest.Mock).mockReturnValue({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
            unsubscribe: jest.fn()
        });

        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'rooms') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: mockRoom,
                                    error: null
                                })
                            })
                        })
                    })
                };
            }

            if (table === 'messages') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            order: jest.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: 'message-1',
                                        room_id: 'room-1',
                                        user_id: 'student-1',
                                        content: 'Is this email fake?',
                                        user_role: 'student',
                                        is_ai_generated: false,
                                        ai_model_used: null,
                                        ai_response_time_ms: null,
                                        parent_message_id: null,
                                        created_at: '2026-03-26T10:00:00Z'
                                    }
                                ],
                                error: null
                            })
                        })
                    })
                };
            }

            if (table === 'users') {
                return {
                    select: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({
                            data: [
                                mockUser,
                                {
                                    id: 'student-1',
                                    display_name: 'Student',
                                    current_role: 'student',
                                    status: 'active',
                                    created_at: '2026-03-20T00:00:00Z',
                                    updated_at: '2026-03-26T00:00:00Z'
                                }
                            ],
                            error: null
                        })
                    })
                };
            }

            throw new Error(`Unexpected table mock: ${table}`);
        });
    });

    it('persists the effective AI config after Quick Adjust regenerate succeeds', async () => {
        (generateTutorSuggestion as jest.Mock)
            .mockResolvedValueOnce({
                suggestion: 'What makes this message suspicious?',
                success: true,
                contextMessages: ['message-1'],
                appliedConfig: {
                    model_name: 'gpt-4o-mini',
                    system_prompt: 'Original prompt',
                    prompt_config: null,
                    temperature: 0.7,
                    max_tokens: 150,
                    is_active: true
                }
            })
            .mockResolvedValueOnce({
                suggestion: 'Which red flags stand out first?',
                success: true,
                contextMessages: ['message-1'],
                appliedConfig: {
                    model_name: 'gpt-4o-mini',
                    system_prompt: 'Updated quick-adjust prompt',
                    prompt_config: {
                        role: { role: 'low' },
                        communication_style: {
                            teen_slang: 'high',
                            conversational_markers: 'low',
                            uncertainty_expression: 'low'
                        },
                        cognitive_parameters: {
                            concept_density: 'low',
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
                        detection_areas: ['Suspicious links'],
                        verification_steps: ['Check sender']
                    },
                    temperature: 0.4,
                    max_tokens: 120
                }
            });

        (updateAIConfig as jest.Mock).mockResolvedValue({
            id: 'room-1',
            room_id: 'room-1',
            model_name: 'gpt-4o-mini',
            system_prompt: 'Updated quick-adjust prompt',
            prompt_config: {
                role: { role: 'low' },
                communication_style: {
                    teen_slang: 'high',
                    conversational_markers: 'low',
                    uncertainty_expression: 'low'
                },
                cognitive_parameters: {
                    concept_density: 'low',
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
                detection_areas: ['Suspicious links'],
                verification_steps: ['Check sender']
            },
            temperature: 0.4,
            max_tokens: 120,
            is_active: true,
            created_at: '2026-03-20T00:00:00Z',
            updated_at: '2026-03-26T12:00:00Z'
        });

        let roomApi: ReturnType<typeof useRoom> | undefined;

        render(
            <RoomProvider>
                <TestRoomHelper onReady={(api) => { roomApi = api; }} />
            </RoomProvider>
        );

        await waitFor(() => {
            expect(roomApi).toBeDefined();
        });

        await act(async () => {
            await roomApi!.joinRoom('room-1');
        });

        await act(async () => {
            await roomApi!.generateAIResponse();
        });

        await act(async () => {
            await roomApi!.regenerateAIResponse({
                communication_style: {
                    conversational_markers: 'low'
                },
                temperature: 0.4,
                max_tokens: 120
            });
        });

        expect(updateAIConfig).toHaveBeenCalledWith(
            'room-1',
            {
                model_name: 'gpt-4o-mini',
                system_prompt: 'Updated quick-adjust prompt',
                prompt_config: {
                    role: { role: 'low' },
                    communication_style: {
                        teen_slang: 'high',
                        conversational_markers: 'low',
                        uncertainty_expression: 'low'
                    },
                    cognitive_parameters: {
                        concept_density: 'low',
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
                    detection_areas: ['Suspicious links'],
                    verification_steps: ['Check sender']
                },
                temperature: 0.4,
                max_tokens: 120,
                is_active: true
            },
            'tutor-1',
            'suggestion_regeneration'
        );

        expect(roomApi!.aiConfig).toMatchObject({
            model_name: 'gpt-4o-mini',
            system_prompt: 'Updated quick-adjust prompt',
            prompt_config: {
                role: { role: 'low' }
            },
            temperature: 0.4,
            max_tokens: 120
        });
    });

    it('records the effective AI config snapshot with each interaction', async () => {
        const generatedSnapshot: AIAssistantConfigSnapshot = {
            model_name: 'gpt-4o-mini',
            system_prompt: 'Original prompt',
            prompt_config: null,
            temperature: 0.7,
            max_tokens: 150,
            is_active: true
        };

        const regeneratedSnapshot: AIAssistantConfigSnapshot = {
            model_name: 'gpt-4o-mini',
            system_prompt: 'Updated quick-adjust prompt',
            prompt_config: {
                role: { role: 'low' }
            } as any,
            temperature: 0.4,
            max_tokens: 120,
            is_active: true
        };

        (generateTutorSuggestion as jest.Mock)
            .mockResolvedValueOnce({
                suggestion: 'What makes this message suspicious?',
                success: true,
                contextMessages: ['message-1'],
                appliedConfig: generatedSnapshot
            })
            .mockResolvedValueOnce({
                suggestion: 'Which red flags stand out first?',
                success: true,
                contextMessages: ['message-1'],
                appliedConfig: regeneratedSnapshot
            });

        (updateAIConfig as jest.Mock).mockResolvedValue({
            id: 'room-1',
            room_id: 'room-1',
            ...regeneratedSnapshot,
            created_at: '2026-03-20T00:00:00Z',
            updated_at: '2026-03-26T12:00:00Z'
        });

        let roomApi: ReturnType<typeof useRoom> | undefined;

        render(
            <RoomProvider>
                <TestRoomHelper onReady={(api) => { roomApi = api; }} />
            </RoomProvider>
        );

        await waitFor(() => {
            expect(roomApi).toBeDefined();
        });

        await act(async () => {
            await roomApi!.joinRoom('room-1');
        });

        await act(async () => {
            await roomApi!.generateAIResponse();
        });

        await act(async () => {
            await roomApi!.regenerateAIResponse({
                role: {
                    role: 'low'
                },
                temperature: 0.4,
                max_tokens: 120
            });
        });

        await act(async () => {
            await roomApi!.recordAIFeedback('accepted', 'Which red flags stand out first?');
        });

        expect(roomApi!.aiInteractions).toEqual([
            expect.objectContaining({
                tutor_action: 'modified',
                ai_config_snapshot: generatedSnapshot
            }),
            expect.objectContaining({
                tutor_action: 'accepted',
                ai_config_snapshot: regeneratedSnapshot
            })
        ]);
    });
});
