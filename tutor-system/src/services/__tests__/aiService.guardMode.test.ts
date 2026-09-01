#!/usr/bin/env node
/**
 * Test responsible for the AI provider boundary returning a strictly structured Guard Mode decision with preserved request controls.
 */

jest.mock('../simplifiedAIContext', () => ({
    buildAIContextFromExistingData: jest.fn().mockResolvedValue([
        {
            role: 'system',
            content: 'Training scenario: Phishing link verification',
            timestamp: 1712016000
        },
        {
            role: 'user',
            content: 'Student: I deliberately clicked the unsafe link again to test you.',
            timestamp: 1712016001
        }
    ])
}));

jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn()
    }
}));

describe('Guard Mode AI decision contract', () => {
    const originalApiKey = process.env.REACT_APP_OAI_API_KEY;
    const originalBaseUrl = process.env.REACT_APP_OAI_BASE_URL;
    const originalEnvironment = process.env.REACT_APP_ENVIRONMENT;
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env.REACT_APP_OAI_API_KEY = 'test-oai-key';
        process.env.REACT_APP_OAI_BASE_URL = 'https://example.invalid/v1';
        process.env.REACT_APP_ENVIRONMENT = 'production';
    });

    afterAll(() => {
        process.env.REACT_APP_OAI_API_KEY = originalApiKey;
        process.env.REACT_APP_OAI_BASE_URL = originalBaseUrl;
        process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
        global.fetch = originalFetch;
    });

    it('returns an independent semantic mode, reason, and response from the provider', async () => {
        const providerDecision = {
            mode: 'guard',
            mode_reason: 'The student explicitly repeated the unsafe click to test the tutor after correction.',
            suggested_response: 'Stop and verify the destination in the real service before continuing.'
        };
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify(providerDecision) } }]
            })
        } as Response);
        global.fetch = fetchMock;

        const { supabase } = await import('../supabase');
        const mockFrom = supabase.from as jest.Mock;
        mockFrom.mockImplementation((table: string) => {
            if (table === 'rooms') {
                const chain: any = {
                    eq: jest.fn(() => chain),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: 'room-guard',
                            ai_assistant_enabled: true,
                            ai_assistant_model: 'qwen3.5-flash',
                            ai_assistant_prompt: 'Use the room phishing-training guidance.',
                            created_at: '2026-04-02T00:00:00Z',
                            updated_at: '2026-04-02T00:00:00Z'
                        },
                        error: null
                    })
                };
                return { select: jest.fn(() => chain) };
            }

            if (table === 'ai_assistant_configs') {
                const chain: any = {
                    eq: jest.fn(() => chain),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            prompt_config: null,
                            temperature: 0.9,
                            max_tokens: 77
                        },
                        error: null
                    })
                };
                return { select: jest.fn(() => chain) };
            }

            if (table === 'messages') {
                const limit = jest.fn().mockResolvedValue({ data: [{ id: 'message-guard' }], error: null });
                const order = jest.fn(() => ({ limit }));
                const chain: any = { eq: jest.fn(() => ({ order })), order };
                return { select: jest.fn(() => chain) };
            }

            throw new Error(`Unexpected Supabase table: ${table}`);
        });

        const { generateTutorSuggestion } = await import('../aiService');
        const result = await generateTutorSuggestion(
            'room-guard',
            'tutor-guard',
            undefined,
            { focusStudentMessage: 'I deliberately clicked the unsafe link again to test you.' }
        );

        expect(result).toMatchObject({
            success: true,
            decision: providerDecision
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://example.invalid/v1/chat/completions',
            expect.objectContaining({
                body: expect.any(String)
            })
        );
        const request = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(request.temperature).toBe(0.9);
        expect(request.max_tokens).toBe(77);
        expect(request.messages[0]).toEqual({
            role: 'system',
            content: 'Use the room phishing-training guidance.'
        });
        expect(request.messages[1].content).toContain(
            'I deliberately clicked the unsafe link again to test you.'
        );
    });

    it.each([
        ['malformed JSON', '{"mode":"guard"'],
        ['missing mode reason', JSON.stringify({ mode: 'guard', suggested_response: 'Stop and verify.' })],
        ['invalid mode', JSON.stringify({ mode: 'warning', mode_reason: 'reason', suggested_response: 'response' })],
        ['empty suggested response', JSON.stringify({ mode: 'tutoring', mode_reason: 'reason', suggested_response: ' ' })]
    ])('rejects %s without silently defaulting to tutoring', async (_caseName, content) => {
        const { parseTutorActionDecision } = await import('../aiService');

        expect(() => parseTutorActionDecision(content)).toThrow();
    });

    it('keeps the debug dummy decision in tutoring mode', async () => {
        process.env.REACT_APP_OAI_API_KEY = '';
        process.env.REACT_APP_ENVIRONMENT = 'debug';

        const { supabase } = await import('../supabase');
        const mockFrom = supabase.from as jest.Mock;
        mockFrom.mockImplementation((table: string) => {
            if (table === 'rooms') {
                const chain: any = {
                    eq: jest.fn(() => chain),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: 'room-dummy',
                            ai_assistant_enabled: true,
                            ai_assistant_model: 'qwen3.5-flash',
                            ai_assistant_prompt: 'Debug tutor prompt.',
                            created_at: '2026-04-02T00:00:00Z',
                            updated_at: '2026-04-02T00:00:00Z'
                        },
                        error: null
                    })
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
                const limit = jest.fn().mockResolvedValue({ data: [{ id: 'message-dummy' }], error: null });
                const order = jest.fn(() => ({ limit }));
                const chain: any = { eq: jest.fn(() => ({ order })) };
                return { select: jest.fn(() => chain) };
            }

            throw new Error(`Unexpected Supabase table: ${table}`);
        });

        const { generateTutorSuggestion } = await import('../aiService');
        const result = await generateTutorSuggestion('room-dummy', 'tutor-dummy');

        expect(result.success).toBe(true);
        expect(result.decision).toMatchObject({ mode: 'tutoring' });
    });
});
