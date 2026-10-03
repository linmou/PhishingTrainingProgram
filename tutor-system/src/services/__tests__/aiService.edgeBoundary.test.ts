#!/usr/bin/env node
/** Test responsibility: verify React uses the ai-api boundary instead of a provider request. */

import fs from 'fs';
import path from 'path';

jest.mock('../supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    from: jest.fn(),
  },
}));

describe('AI service Edge Function boundary', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('invokes ai-api with chat data and never sends provider credentials from React', async () => {
    const { supabase } = await import('../supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({
      data: { content: 'Use the official app.', model: 'qwen3.5-flash', finish_reason: 'stop' },
      error: null,
    });

    const { QwenService } = await import('../aiService');
    const result = await QwenService.generateResponse(
      'How do I verify this link?',
      [{ role: 'user', content: 'I received a message.', timestamp: 1 }],
      {
        id: 'config-1',
        room_id: 'room-1',
        model_name: 'qwen3.5-flash',
        system_prompt: 'Be concise.',
        prompt_config: null,
        temperature: 0.2,
        max_tokens: 800,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    );

    expect(result).toMatchObject({ content: 'Use the official app.', success: true, model_used: 'qwen3.5-flash' });
    expect(invoke).toHaveBeenCalledWith('ai-api', {
      body: expect.objectContaining({
        messages: expect.any(Array),
        temperature: 0.2,
        max_tokens: 800,
      }),
    });
    const invocation = invoke.mock.calls[0][1].body;
    expect(invocation).not.toHaveProperty('api_key');
    expect(invocation).not.toHaveProperty('base_url');
    expect(JSON.stringify(invocation)).not.toContain('Bearer');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('routes tutor decision repair through ai-api', async () => {
    const { supabase } = await import('../supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    const validDecision = {
      reason: 'The learner needs a concise safety reminder.',
      decision: { mode: 'tutoring', instruction: 'scaffolding' },
      response: 'Verify the sender through the official app.',
    };
    invoke
      .mockResolvedValueOnce({ data: { content: '{"invalid":true}', model: 'qwen3.5-flash', finish_reason: 'stop' }, error: null })
      .mockResolvedValueOnce({ data: { content: JSON.stringify(validDecision), model: 'qwen3.5-flash', finish_reason: 'stop' }, error: null });

    const { TutorSuggestionService } = await import('../aiService');
    const result = await TutorSuggestionService.generateSuggestion(
      [{ role: 'user', content: 'I received a suspicious link.', timestamp: 1 }],
      {
        id: 'config-retry',
        room_id: 'room-retry',
        model_name: 'qwen3.5-flash',
        system_prompt: 'Be concise.',
        prompt_config: null,
        temperature: 0.2,
        max_tokens: 80,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      { focusStudentMessage: 'I received a suspicious link.', scenarioContext: 'Link safety' },
    );

    expect(result.success).toBe(true);
    expect(result.suggestion).toBe(validDecision.response);
    expect(invoke).toHaveBeenCalledTimes(2);
    const retryMessages = invoke.mock.calls[1][1].body.messages;
    expect(retryMessages[retryMessages.length - 1].content)
      .toContain('Return exactly one valid JSON object');
  });

  it('routes checklist extraction through ai-api and removes legacy browser provider paths', async () => {
    const { supabase } = await import('../supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({
      data: {
        content: JSON.stringify({
          understanding: ['[understanding] Suspicious domains'],
          behavior: ['[behavior] Verify through the official app'],
        }),
        model: 'qwen3.5-flash',
        finish_reason: 'stop',
      },
      error: null,
    });

    const { LLMExtractionService } = await import('../llmExtractionService');
    await expect(LLMExtractionService.extractFromSystemPrompt('## Detection Areas\n- Suspicious domains'))
      .resolves.toEqual({
        understanding: ['[understanding] Suspicious domains'],
        behavior: ['[behavior] Verify through the official app'],
      });
    expect(invoke).toHaveBeenCalled();

    const servicePaths = [
      path.resolve(__dirname, '..', 'aiService.ts'),
      path.resolve(__dirname, '..', 'aiService.original.ts'),
      path.resolve(__dirname, '..', 'llmExtractionService.ts'),
      path.resolve(__dirname, '..', '..', '..', '.env.example'),
    ];
    servicePaths.forEach((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(source).not.toMatch(/REACT_APP_OAI_(?:API_KEY|BASE_URL)/);
      expect(source).not.toContain('/chat/completions');
    });
  });
});
