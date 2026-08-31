#!/usr/bin/env node
/** Purpose: verify visible Qwen provider failures and verbatim quote cleanup. */

jest.mock('../simplifiedAIContext', () => ({
    buildAIContextFromExistingData: jest.fn()
}));

jest.mock('../supabase', () => ({
    supabase: { from: jest.fn() }
}));

import { generateTutorSuggestion } from '../aiService';
import { buildAIContextFromExistingData } from '../simplifiedAIContext';
import { supabase } from '../supabase';

const mockBuildAIContext = buildAIContextFromExistingData as jest.MockedFunction<typeof buildAIContextFromExistingData>;
const mockSupabaseFrom = supabase.from as jest.Mock;

function configureSupabaseMocks() {
    mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'rooms') {
            const roomResult = {
                id: 'room-123',
                ai_assistant_enabled: true,
                ai_assistant_model: 'gpt-4o-mini',
                ai_assistant_prompt: 'Use room-level tutor guidance.',
                created_at: '2026-03-20T00:00:00Z',
                updated_at: '2026-03-26T00:00:00Z'
            };
            const chain: any = {
                eq: jest.fn(() => chain),
                single: jest.fn().mockResolvedValue({ data: roomResult, error: null })
            };
            return { select: jest.fn(() => chain) };
        }
        if (table === 'ai_assistant_configs') {
            const chain: any = {
                eq: jest.fn(() => chain),
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            };
            return { select: jest.fn(() => chain) };
        }
        if (table === 'messages') {
            const limit = jest.fn().mockResolvedValue({ data: [{ id: 'message-1' }, { id: 'message-2' }] });
            const order = jest.fn(() => ({ limit }));
            return { select: jest.fn(() => ({ eq: jest.fn(() => ({ order })) })) };
        }
        throw new Error(`Unexpected Supabase table: ${table}`);
    });
}

describe('AI Service provider failure behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockBuildAIContext.mockResolvedValue([
            { role: 'system', content: 'You are helping a tutor guide a phishing discussion.' },
            { role: 'user', content: 'Student: This Nintendo Switch offer looks suspicious.' }
        ]);
        configureSupabaseMocks();
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized'
        } as Response);
    });

    afterEach(() => jest.restoreAllMocks());

    it('returns the Qwen provider error instead of a dummy suggestion when the API responds with 401', async () => {
        const result = await generateTutorSuggestion('room-123', 'tutor-123');
        expect(result.success).toBe(false);
        expect(result.error).toContain('401');
        expect(result.suggestion).toBe('');
        expect(result.contextMessages).toEqual(['message-1', 'message-2']);
    });

    it('strips only wrapping quotes from a successful Qwen suggestion', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: '"What makes the sender address look suspicious to you?"' } }] })
        } as Response);

        const result = await generateTutorSuggestion('room-123', 'tutor-123');
        expect(result.success).toBe(true);
        expect(result.suggestion).toBe('What makes the sender address look suspicious to you?');
        expect(result.appliedConfig).toMatchObject({
            model_name: 'qwen3.5-flash',
            system_prompt: 'Use room-level tutor guidance.'
        });
    });
});
