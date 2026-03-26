#!/usr/bin/env node
/**
 * Test responsible for aiService.ts room-based AI configuration persistence after removing ai_assistant_configs from the runtime path.
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

const mockSupabaseFrom = supabase.from as jest.Mock;
const mockSupabaseRpc = supabase.rpc as jest.Mock;

describe('AI Service room source of truth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads AI config directly from room fields', async () => {
        mockSupabaseFrom.mockReturnValueOnce({
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
        });

        await expect(getAIConfig('room-1')).resolves.toMatchObject({
            id: 'room-1',
            room_id: 'room-1',
            model_name: 'gpt-4o',
            system_prompt: 'Room-backed AI prompt.',
            is_active: true,
            created_at: '2026-03-25T00:00:00Z',
            updated_at: '2026-03-26T00:00:00Z'
        });
    });

    it('initializes AI by updating room fields instead of ai_assistant_configs', async () => {
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
            });

        await expect(
            initializeAIAssistant('room-1', 'gpt-4o', 'Initialize prompt', 'tutor-1')
        ).resolves.toBe('room-1');

        expect(mockSupabaseFrom).toHaveBeenCalledTimes(2);
        expect(mockSupabaseFrom.mock.calls[0][0]).toBe('rooms');
        expect(mockSupabaseFrom.mock.calls[1][0]).toBe('rooms');
    });

    it('updates AI config through room fields and returns a synthesized config', async () => {
        mockSupabaseFrom.mockReturnValueOnce({
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
        });

        await expect(
            updateAIConfig('room-2', {
                model_name: 'gpt-4',
                system_prompt: 'Updated room prompt.',
                is_active: true
            })
        ).resolves.toMatchObject({
            id: 'room-2',
            room_id: 'room-2',
            model_name: 'gpt-4',
            system_prompt: 'Updated room prompt.',
            is_active: true
        });

        expect(mockSupabaseFrom).toHaveBeenCalledWith('rooms');
    });
});
