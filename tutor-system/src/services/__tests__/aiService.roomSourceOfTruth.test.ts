#!/usr/bin/env node
/**
 * Test responsible for aiService.ts using room fields for base AI settings and ai_assistant_configs for persisted extended config fields.
 */

jest.mock('../simplifiedAIContext', () => ({
    buildAIContextFromExistingData: jest.fn()
}));

jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn()
    }
}));

import { getAIConfig, initializeAIAssistant, updateAIConfig } from '../aiService';
import { supabase } from '../supabase';
import { generateSystemPrompt, PRESET_CONFIGS } from '../systemPrompts';

const mockSupabaseFrom = supabase.from as jest.Mock;
const mockSupabaseRpc = supabase.rpc as jest.Mock;

describe('AI Service room source of truth', () => {
    const originalEnvironment = process.env.REACT_APP_ENVIRONMENT;

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.REACT_APP_ENVIRONMENT;
    });

    afterAll(() => {
        if (originalEnvironment === undefined) {
            delete process.env.REACT_APP_ENVIRONMENT;
            return;
        }

        process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
    });

    it('loads AI config from room fields and merges persisted extended config', async () => {
        const normalizedPromptConfig = {
            ...PRESET_CONFIGS.supportive_adult,
            role: { role: 'low' as const }
        };

        mockSupabaseFrom
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'room-1',
                                ai_assistant_enabled: true,
                                ai_assistant_model: 'gpt-4o',
                                ai_assistant_prompt: 'Room-backed AI prompt.',
                                created_at: '2026-03-25T00:00:00Z',
                                updated_at: '2026-03-26T00:00:00Z'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    prompt_config: {
                                        role: { role: 'low' }
                                    },
                                    temperature: 0.4,
                                    max_tokens: 120
                                },
                                error: null
                            })
                        })
                    })
                })
            });

        await expect(getAIConfig('room-1')).resolves.toMatchObject({
            id: 'room-1',
            room_id: 'room-1',
            model_name: 'gpt-4o',
            system_prompt: generateSystemPrompt({
                ...normalizedPromptConfig,
                detection_areas: [],
                verification_steps: []
            }),
            prompt_config: {
                role: { role: 'low' }
            },
            temperature: 0.4,
            max_tokens: 120,
            is_active: true,
            created_at: '2026-03-25T00:00:00Z',
            updated_at: '2026-03-26T00:00:00Z'
        });
    });

    it('regenerates the effective system prompt from persisted prompt_config when room prompt is stale', async () => {
        const promptConfig = {
            role: { role: 'high' as const },
            communication_style: {
                teen_slang: 'low' as const,
                conversational_markers: 'low' as const,
                uncertainty_expression: 'low' as const
            },
            cognitive_parameters: {
                concept_density: 'high' as const,
                perspective_taking: 'high' as const,
                personal_examples: 'high' as const,
                consequence_highlighting: 'high' as const
            },
            emotional_parameters: {
                enthusiasm_level: 'low' as const,
                validation_frequency: 'high' as const,
                mistake_normalization: 'high' as const,
                confidence_building: 'high' as const
            },
            detection_areas: [
                'Real-time location sharing: Announcing specific places and times'
            ],
            verification_steps: [
                'Use private messages: Coordinate meetups via DM instead of public posts'
            ]
        };

        mockSupabaseFrom
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'room-9',
                                ai_assistant_enabled: true,
                                ai_assistant_model: 'gpt-4o',
                                ai_assistant_prompt: 'Generic stale prompt',
                                created_at: '2026-04-02T00:00:00Z',
                                updated_at: '2026-04-02T00:00:00Z'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    prompt_config: promptConfig,
                                    temperature: 0.7,
                                    max_tokens: 150
                                },
                                error: null
                            })
                        })
                    })
                })
            });

        await expect(getAIConfig('room-9')).resolves.toMatchObject({
            room_id: 'room-9',
            prompt_config: promptConfig,
            system_prompt: generateSystemPrompt(promptConfig)
        });
    });

    it('initializes AI by updating room fields and persisting extended config', async () => {
        mockSupabaseRpc.mockResolvedValue({
            data: null,
            error: {
                code: '42883',
                message: 'function initialize_ai_assistant does not exist'
            }
        });

        mockSupabaseFrom
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                tutor_id: 'tutor-1'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    id: 'room-1'
                                },
                                error: null
                            })
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'PGRST116', message: 'No rows found' }
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            });

        await expect(
            initializeAIAssistant('room-1', 'gpt-4o', 'Initialize prompt', 'tutor-1')
        ).resolves.toBe('room-1');

        expect(mockSupabaseFrom).toHaveBeenCalledTimes(4);
        expect(mockSupabaseFrom.mock.calls[0][0]).toBe('rooms');
        expect(mockSupabaseFrom.mock.calls[1][0]).toBe('rooms');
        expect(mockSupabaseFrom.mock.calls[2][0]).toBe('ai_assistant_configs');
        expect(mockSupabaseFrom.mock.calls[3][0]).toBe('ai_assistant_configs');
    });

    it('updates AI config through room fields and persists structured prompt config', async () => {
        mockSupabaseFrom
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'room-2',
                                ai_assistant_enabled: true,
                                ai_assistant_model: 'gpt-4o',
                                ai_assistant_prompt: 'Old prompt.',
                                created_at: '2026-03-20T00:00:00Z',
                                updated_at: '2026-03-26T11:00:00Z'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    prompt_config: null,
                                    temperature: 0.7,
                                    max_tokens: 150
                                },
                                error: null
                            })
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    id: 'room-2',
                                    ai_assistant_enabled: true,
                                    ai_assistant_model: 'gpt-4',
                                    ai_assistant_prompt: 'Updated room prompt.',
                                    created_at: '2026-03-20T00:00:00Z',
                                    updated_at: '2026-03-26T12:00:00Z'
                                },
                                error: null
                            })
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'ai-config-1'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        data: null,
                        error: null
                    })
                })
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            });

        await expect(
            updateAIConfig('room-2', {
                model_name: 'gpt-4',
                system_prompt: 'Updated room prompt.',
                prompt_config: {
                    role: { role: 'low' }
                },
                temperature: 0.4,
                max_tokens: 120,
                is_active: true
            }, 'tutor-2')
        ).resolves.toMatchObject({
            id: 'room-2',
            room_id: 'room-2',
            model_name: 'gpt-4',
            system_prompt: 'Updated room prompt.',
            prompt_config: {
                role: { role: 'low' }
            },
            temperature: 0.4,
            max_tokens: 120,
            is_active: true
        });

        expect(mockSupabaseFrom).toHaveBeenNthCalledWith(1, 'rooms');
        expect(mockSupabaseFrom).toHaveBeenNthCalledWith(2, 'ai_assistant_configs');
        expect(mockSupabaseFrom).toHaveBeenNthCalledWith(3, 'rooms');
        expect(mockSupabaseFrom).toHaveBeenNthCalledWith(4, 'ai_assistant_configs');
        expect(mockSupabaseFrom).toHaveBeenNthCalledWith(5, 'ai_assistant_configs');
        expect(mockSupabaseFrom).toHaveBeenNthCalledWith(6, 'ai_assistant_config_logs');

        const insertMock = mockSupabaseFrom.mock.results[5].value.insert as jest.Mock;
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            room_id: 'room-2',
            changed_by_user_id: 'tutor-2',
            change_reason: 'settings_update',
            changed_fields: ['model_name', 'system_prompt', 'prompt_config', 'temperature', 'max_tokens'],
            previous_config: {
                model_name: 'gpt-4o',
                system_prompt: 'Old prompt.',
                prompt_config: null,
                temperature: 0.7,
                max_tokens: 150,
                is_active: true
            },
            new_config: {
                model_name: 'gpt-4',
                system_prompt: 'Updated room prompt.',
                prompt_config: {
                    role: { role: 'low' }
                },
                temperature: 0.4,
                max_tokens: 120,
                is_active: true
            }
        }));
    });

    it('fails the config update in production when AI config logging fails', async () => {
        process.env.REACT_APP_ENVIRONMENT = 'production';

        mockSupabaseFrom
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'room-3',
                                ai_assistant_enabled: true,
                                ai_assistant_model: 'gpt-4o',
                                ai_assistant_prompt: 'Original prompt.',
                                created_at: '2026-03-20T00:00:00Z',
                                updated_at: '2026-03-26T11:00:00Z'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    prompt_config: null,
                                    temperature: 0.7,
                                    max_tokens: 150
                                },
                                error: null
                            })
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    id: 'room-3',
                                    ai_assistant_enabled: true,
                                    ai_assistant_model: 'gpt-4o',
                                    ai_assistant_prompt: 'Adjusted prompt.',
                                    created_at: '2026-03-20T00:00:00Z',
                                    updated_at: '2026-03-26T12:00:00Z'
                                },
                                error: null
                            })
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'ai-config-3'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: null
                    })
                })
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: {
                        code: '42P01',
                        message: 'relation "public.ai_assistant_config_logs" does not exist'
                    }
                })
            });

        await expect(
            updateAIConfig('room-3', {
                system_prompt: 'Adjusted prompt.',
                prompt_config: {
                    role: { role: 'high' }
                },
                temperature: 0.5,
                max_tokens: 180,
                is_active: true
            }, 'tutor-3')
        ).rejects.toThrow('Failed to record AI config change: relation "public.ai_assistant_config_logs" does not exist');
    });

    it('allows the config update in debug when AI config logging fails', async () => {
        process.env.REACT_APP_ENVIRONMENT = 'debug';

        mockSupabaseFrom
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'room-4',
                                ai_assistant_enabled: true,
                                ai_assistant_model: 'gpt-4o',
                                ai_assistant_prompt: 'Original prompt.',
                                created_at: '2026-03-20T00:00:00Z',
                                updated_at: '2026-03-26T11:00:00Z'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    prompt_config: null,
                                    temperature: 0.7,
                                    max_tokens: 150
                                },
                                error: null
                            })
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    id: 'room-4',
                                    ai_assistant_enabled: true,
                                    ai_assistant_model: 'gpt-4o',
                                    ai_assistant_prompt: 'Adjusted prompt.',
                                    created_at: '2026-03-20T00:00:00Z',
                                    updated_at: '2026-03-26T12:00:00Z'
                                },
                                error: null
                            })
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'ai-config-4'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: null
                    })
                })
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: {
                        code: '42P01',
                        message: 'relation "public.ai_assistant_config_logs" does not exist'
                    }
                })
            });

        await expect(
            updateAIConfig('room-4', {
                system_prompt: 'Adjusted prompt.',
                prompt_config: {
                    role: { role: 'high' }
                },
                temperature: 0.5,
                max_tokens: 180,
                is_active: true
            }, 'tutor-4')
        ).resolves.toMatchObject({
            id: 'room-4',
            room_id: 'room-4',
            system_prompt: 'Adjusted prompt.',
            temperature: 0.5,
            max_tokens: 180,
            is_active: true
        });
    });
});
