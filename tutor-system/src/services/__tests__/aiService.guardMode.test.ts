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
        from: jest.fn(),
        functions: { invoke: jest.fn() }
    }
}));

jest.mock('../checklistService', () => ({ ChecklistService: {
    getChecklistByRoom: jest.fn().mockResolvedValue(null)
} }));

describe('Guard Mode AI decision contract', () => {
    const originalEnvironment = process.env.REACT_APP_ENVIRONMENT;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env.REACT_APP_ENVIRONMENT = 'production';
    });

    afterAll(() => {
        process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
    });

    it('treats a newly created tutoring room with no mode history as unknown prior mode', async () => {
        const { resolveTutorPriorMode } = await import('../aiService');

        expect(resolveTutorPriorMode({ active_response_mode: 'tutoring', mode_changed_at: null })).toBe('unknown');
        expect(resolveTutorPriorMode({ active_response_mode: 'guard', mode_changed_at: null })).toBe('guard');
        expect(resolveTutorPriorMode({ active_response_mode: 'tutoring', mode_changed_at: '2026-04-02T00:00:00Z' })).toBe('tutoring');
    });

    it('returns an independent semantic mode, reason, and response from the provider', async () => {
        const providerDecision = {
            reason: 'The student explicitly repeated the unsafe click to test the tutor after correction.',
            decision: { mode: 'guard', instruction: null },
            response: 'Stop repeating that behavior and make a relevant attempt.'
        };
        const invokeMock = jest.fn().mockResolvedValue({
            data: { content: JSON.stringify(providerDecision), model: 'qwen3.5-flash', finish_reason: 'stop' },
            error: null
        } as Response);

        const { supabase } = await import('../supabase');
        (supabase.functions.invoke as jest.Mock).mockImplementation(invokeMock);
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
                            active_response_mode: 'guard',
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
        const { ChecklistService } = await import('../checklistService');
        (ChecklistService.getChecklistByRoom as jest.Mock).mockResolvedValueOnce({
            detection_areas: [{ area_text: 'Recognize urgent pressure', status: 'covered' }],
            verification_steps: [{ area_text: 'Open the official app', status: 'pending' }]
        });
        const result = await generateTutorSuggestion(
            'room-guard',
            'tutor-guard',
            undefined,
            { focusStudentMessage: 'I deliberately clicked the unsafe link again to test you.' }
        );

        expect(result).toMatchObject({
            success: true,
            suggestion: providerDecision.response,
            decision: {
                mode: 'guard',
                mode_reason: providerDecision.reason,
                suggested_response: providerDecision.response
            }
        });

        expect(invokeMock).toHaveBeenCalledWith('ai-api', expect.objectContaining({ body: expect.any(Object) }));
        const request = invokeMock.mock.calls[0][1].body;
        expect(request.temperature).toBe(0.9);
        expect(request.max_tokens).toBe(77);
        expect(request.messages[0].role).toBe('system');
        expect(request.messages[0].content).toContain('Use the room phishing-training guidance.');
        expect(request.messages[0].content).toContain('CURRENT LEARNING PROGRESS');
        expect(request.messages[0].content).toContain('Open the official app');
        expect(request.messages[0].content).toContain('pending');
        expect(request.messages[0].content).toContain('ACTIVE RESPONSE CONTRACT (v2)');
        expect(request.messages[1].content).toContain(
            'I deliberately clicked the unsafe link again to test you.'
        );
        expect(request.messages[1].content).toContain('"prior_mode":"guard"');
    });

    it.each([
        ['malformed JSON', '{"reason":"evidence"'],
        ['missing reason', JSON.stringify({ decision: { mode: 'guard', instruction: null }, response: 'Stop and try.' })],
        ['invalid mode', JSON.stringify({ reason: 'evidence', decision: { mode: 'warning', instruction: null }, response: 'Try again.' })],
        ['empty response', JSON.stringify({ reason: 'evidence', decision: { mode: 'tutoring', instruction: 'scaffolding' }, response: ' ' })]
    ])('rejects %s without silently defaulting to tutoring', async (_caseName, content) => {
        const { parseTutorActionDecision } = await import('../aiService');

        expect(() => parseTutorActionDecision(content)).toThrow();
    });

    it('keeps the debug dummy decision in tutoring mode', async () => {
        process.env.REACT_APP_ENVIRONMENT = 'debug';
        process.env.REACT_APP_USE_DUMMY_AI = 'true';

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

    it('retries a malformed provider decision once with JSON regulation', async () => {
        const validDecision = {
            reason: 'The student repeated the unsafe action after correction.',
            decision: { mode: 'guard', instruction: null },
            response: 'Stop repeating that behavior and make a relevant attempt.'
        };
        const invokeMock = jest
            .fn()
            .mockResolvedValueOnce({ data: { content: '{"mode":"guard"', model: 'qwen3.5-flash' }, error: null })
            .mockResolvedValueOnce({ data: { content: JSON.stringify(validDecision), model: 'qwen3.5-flash' }, error: null });
        const { supabase } = await import('../supabase');
        (supabase.functions.invoke as jest.Mock).mockImplementation(invokeMock);

        const { TutorSuggestionService } = await import('../aiService');
        const result = await TutorSuggestionService.generateSuggestion(
            [{ role: 'user', content: 'I clicked it again.', timestamp: 1 }],
            {
                id: 'config-retry',
                room_id: 'room-retry',
                model_name: 'qwen3.5-flash',
                system_prompt: 'Keep the response concise.',
                prompt_config: null,
                temperature: 0.2,
                max_tokens: 80,
                is_active: true,
                created_at: '2026-04-02T00:00:00Z',
                updated_at: '2026-04-02T00:00:00Z'
            },
            { focusStudentMessage: 'I clicked it again.', scenarioContext: 'Link safety' }
        );

        expect(result).toMatchObject({
            success: true,
            suggestion: validDecision.response,
            decision: {
                mode: 'guard',
                mode_reason: validDecision.reason,
                suggested_response: validDecision.response
            }
        });
        expect(invokeMock).toHaveBeenCalledTimes(2);
        invokeMock.mock.calls.forEach((call) => {
            expect(call[1].body.response_format).toEqual({ type: 'json_object' });
        });
        const retryRequest = invokeMock.mock.calls[1][1].body;
        expect(retryRequest.messages[retryRequest.messages.length - 1].content)
            .toContain('Return exactly one valid JSON object');
    });

});
