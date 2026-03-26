#!/usr/bin/env node
/**
 * Test responsible for aiService.ts tutor suggestion fallback behavior when the configured AI provider rejects the request.
 */

jest.mock('../simplifiedAIContext', () => ({
    buildAIContextFromExistingData: jest.fn()
}));

jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn()
    }
}));

import { generateTutorSuggestion } from '../aiService';
import { buildAIContextFromExistingData } from '../simplifiedAIContext';
import { supabase } from '../supabase';

const mockBuildAIContext = buildAIContextFromExistingData as jest.MockedFunction<typeof buildAIContextFromExistingData>;
const mockSupabaseFrom = supabase.from as jest.Mock;

describe('AI Service auth fallback', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockBuildAIContext.mockResolvedValue([
            {
                role: 'system',
                content: 'You are helping a tutor guide a phishing discussion.'
            },
            {
                role: 'user',
                content: 'Student: This Nintendo Switch offer looks suspicious.'
            }
        ]);

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized'
        } as Response);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns a dummy tutor suggestion when the configured AI API responds with 401', async () => {
        mockSupabaseFrom
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                ai_assistant_enabled: true,
                                ai_assistant_model: 'gpt-4o'
                            },
                            error: null
                        })
                    })
                })
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'room-123',
                                ai_assistant_enabled: true,
                                ai_assistant_model: 'gpt-4o',
                                ai_assistant_prompt: 'Use room-level tutor guidance.',
                                created_at: '2026-03-20T00:00:00Z',
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
                        order: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue({
                                data: [
                                    { id: 'message-1' },
                                    { id: 'message-2' }
                                ]
                            })
                        })
                    })
                })
            });

        const result = await generateTutorSuggestion('room-123', 'tutor-123');

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.suggestion).toBeTruthy();
        expect(result.contextMessages).toEqual(['message-1', 'message-2']);
    });
});
