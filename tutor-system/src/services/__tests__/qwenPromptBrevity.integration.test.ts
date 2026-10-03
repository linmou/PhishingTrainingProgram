#!/usr/bin/env node
/** Test responsibility: verify Qwen content and controls cross the ai-api boundary unchanged. */

import fs from 'fs';
import path from 'path';
import type { AIAssistantConfig, ConversationMessage } from '../../types';

jest.mock('../supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const config = (systemPrompt: string): AIAssistantConfig => ({
  id: 'qwen-brevity-test',
  room_id: 'qwen-brevity-room',
  model_name: 'qwen3.5-flash',
  system_prompt: systemPrompt,
  prompt_config: null,
  temperature: 0.25,
  max_tokens: 77,
  is_active: true,
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
});

describe('Qwen prompt boundary behavior', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('uses the authenticated Edge Function and forwards the complete request controls', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../aiService.ts'), 'utf8');
    expect(source).toMatch(/functions\.invoke\(['"]ai-api['"]/);
    expect(source).toMatch(/enable_thinking:\s*false/);
    expect(source).toMatch(/temperature/);
    expect(source).toMatch(/max_tokens/);
    expect(source).toMatch(/response_format/);
    expect(source).not.toContain('/chat/completions');
  });

  it('preserves an over-limit response exactly on both production paths', async () => {
    const overLimit = 'One. Two. Three. Four. ' + Array.from({ length: 51 }, (_, index) => `word${index + 1}`).join(' ');
    const { supabase } = await import('../supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke
      .mockResolvedValueOnce({ data: { content: overLimit, model: 'qwen3.5-flash', finish_reason: 'stop' }, error: null })
      .mockResolvedValueOnce({ data: { content: JSON.stringify({
        reason: 'The learner needs a contextual explanation.',
        decision: { mode: 'tutoring', instruction: 'explanation' },
        response: overLimit,
      }), model: 'qwen3.5-flash', finish_reason: 'stop' }, error: null });

    const aiService = await import('../aiService');
    const history: ConversationMessage[] = [{ role: 'user', content: 'The alert looks real.', timestamp: 1 }];
    const direct = await aiService.QwenService.generateResponse('What should I check?', history, config('DIRECT'));
    const suggestion = await aiService.TutorSuggestionService.generateSuggestion(history, config('SUGGESTION'), {
      focusStudentMessage: 'The alert looks real?',
      scenarioContext: 'Account Security Alert',
      priorMode: 'tutoring',
    });

    expect(direct).toMatchObject({ success: true, content: overLimit, model_used: 'qwen3.5-flash' });
    expect(suggestion).toMatchObject({ success: true, suggestion: overLimit });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[0][0]).toBe('ai-api');
    expect(invoke.mock.calls[0][1].body).toMatchObject({
      temperature: 0.25,
      max_tokens: 77,
      enable_thinking: false,
    });
    expect(invoke.mock.calls[1][1].body.response_format).toEqual({ type: 'json_object' });
  });

  it('keeps Edge Function failures visible instead of replacing them with dummy content', async () => {
    const { supabase } = await import('../supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({ data: null, error: { message: 'AI provider returned HTTP 502' } });

    const aiService = await import('../aiService');
    const result = await aiService.QwenService.generateResponse('Check this.', [], config('ERROR'));
    expect(result).toMatchObject({ success: false, content: '', error: 'AI provider returned HTTP 502' });

    const suggestion = await aiService.TutorSuggestionService.generateSuggestion([], config('ERROR'));
    expect(suggestion).toMatchObject({ success: false, suggestion: '', error: 'AI provider returned HTTP 502' });
  });
});
