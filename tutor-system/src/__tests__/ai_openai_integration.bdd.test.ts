#!/usr/bin/env node
/** Test responsibility: verify application LLM requests use the ai-api boundary for offline users. */

import type { AIAssistantConfig } from '../types';

jest.mock('../services/supabase', () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}));
jest.mock('../services/simplifiedAIContext', () => ({
  buildAIContextFromExistingData: jest.fn().mockResolvedValue([
    { role: 'system', content: 'Training scenario: verify suspicious messages.' },
    { role: 'user', content: 'Student: Is this message legitimate?' },
  ]),
}));
jest.mock('../services/checklistService', () => ({
  ChecklistService: { getChecklistByRoom: jest.fn().mockResolvedValue(null) },
}));

const ROOM_ID = 'qwen-feature-room';
const RESPONSE = 'Check the sender and verify through the official site.';
const DECISION = JSON.stringify({
  reason: 'The learner is checking an unexpected request.',
  decision: { mode: 'tutoring', instruction: 'explanation' },
  response: RESPONSE,
});
const ROOM = {
  id: ROOM_ID,
  title: 'Qwen Integration Room',
  description: 'Cybersecurity education',
  ai_assistant_enabled: true,
  ai_assistant_model: 'qwen3.5-flash',
  ai_assistant_prompt: 'Focus on cybersecurity education.',
  active_response_mode: 'tutoring',
  mode_changed_at: '2026-01-01T00:00:00.000Z',
};
const CONFIG: AIAssistantConfig = {
  id: 'qwen-feature-config',
  room_id: ROOM_ID,
  model_name: 'qwen3.5-flash',
  system_prompt: ROOM.ai_assistant_prompt,
  prompt_config: null,
  temperature: 0.7,
  max_tokens: 300,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function configureDatabase(): void {
  const { supabase } = require('../services/supabase');
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const result = table === 'rooms'
      ? { data: ROOM, error: null }
      : table === 'ai_assistant_configs'
        ? { data: CONFIG, error: null }
        : table === 'messages'
          ? { data: [{ id: 'student-message-1' }], error: null }
          : { data: null, error: null };
    const query: any = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn(() => query);
    query.order = jest.fn(() => query);
    query.limit = jest.fn(async () => result);
    query.single = jest.fn(async () => result);
    query.then = (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return query;
  });
}

describe('Qwen API integration through Supabase', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.REACT_APP_ENVIRONMENT = 'production';
    configureDatabase();
  });

  it('sends the configured chat payload through ai-api without browser provider settings', async () => {
    const { supabase } = require('../services/supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({ data: { content: DECISION, model: 'qwen3.5-flash', finish_reason: 'stop' }, error: null });

    const { TutorSuggestionService } = await import('../services/aiService');
    const result = await TutorSuggestionService.generateSuggestion([
      { role: 'user', content: 'Student: Is this message safe?' },
    ], CONFIG);

    expect(result).toMatchObject({ success: true, suggestion: RESPONSE });
    expect(invoke).toHaveBeenCalledWith('ai-api', {
      body: expect.objectContaining({
        temperature: 0.7,
        max_tokens: 120,
        enable_thinking: false,
        response_format: { type: 'json_object' },
      }),
    });
    expect(JSON.stringify(invoke.mock.calls[0][1].body)).not.toContain('Bearer');
    expect(JSON.stringify(invoke.mock.calls[0][1].body)).not.toContain('OAI_API_KEY');
  });

  it('keeps provider failures visible without exposing provider details', async () => {
    const { supabase } = require('../services/supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({ data: null, error: { message: 'AI provider returned HTTP 503' } });

    const { QwenService } = await import('../services/aiService');
    const result = await QwenService.generateResponse('Check this.', [], CONFIG);

    expect(result).toMatchObject({ success: false, content: '', error: 'AI provider returned HTTP 503' });
    expect(result.error).not.toContain('OAI_API_KEY');
  });

  it('uses the explicit debug dummy opt-in without making a provider request', async () => {
    process.env.REACT_APP_ENVIRONMENT = 'debug';
    process.env.REACT_APP_USE_DUMMY_AI = 'true';
    const { supabase } = require('../services/supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    const { generateTutorSuggestion } = await import('../services/aiService');

    const result = await generateTutorSuggestion(ROOM_ID, 'tutor-1');

    expect(result).toMatchObject({ success: true, decision: { mode: 'tutoring' } });
    expect(invoke).not.toHaveBeenCalled();
    delete process.env.REACT_APP_USE_DUMMY_AI;
  });
});
