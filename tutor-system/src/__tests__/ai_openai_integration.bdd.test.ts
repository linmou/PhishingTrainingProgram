#!/usr/bin/env node
/** File: src/__tests__/ai_openai_integration.bdd.test.ts; Purpose: bind feasible Qwen API integration scenarios to the real service boundary with deterministic mocked network and persistence. */

import { defineFeature, loadFeature } from 'jest-cucumber';
import type { AIAssistantConfig, ConversationMessage } from '../types';

jest.mock('../services/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../services/simplifiedAIContext', () => ({ buildAIContextFromExistingData: jest.fn() }));
jest.mock('../services/checklistService', () => ({ ChecklistService: { getChecklistByRoom: jest.fn() } }));

const feature = loadFeature('./features/ai_openai_integration.feature', { tagFilter: 'not @non_feasible' });
const API_KEY = 'qwen-feature-test-key';
const BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const ROOM_ID = 'qwen-feature-room';
const TUTOR_ID = 'qwen-feature-tutor';
const RESPONSE = 'Check the sender and verify through the official site.';
const DECISION = {
  reason: 'The learner is checking an unexpected request.',
  decision: { mode: 'tutoring', instruction: 'explanation' },
  response: RESPONSE,
};
const DEFAULT_CONFIG: AIAssistantConfig = {
  id: 'qwen-feature-config',
  room_id: ROOM_ID,
  model_name: 'qwen3.5-flash',
  system_prompt: 'Focus on cybersecurity education.',
  prompt_config: null,
  temperature: 0.7,
  max_tokens: 300,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
const ROOM = {
  id: ROOM_ID,
  title: 'Qwen Integration Room',
  description: 'Cybersecurity education',
  tutor_id: TUTOR_ID,
  ai_assistant_enabled: true,
  ai_assistant_model: 'qwen3.5-flash',
  ai_assistant_prompt: DEFAULT_CONFIG.system_prompt,
  active_response_mode: 'tutoring',
  mode_changed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const jsonResponse = (content: string): Response => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
} as Response);

const configWith = (overrides: Partial<AIAssistantConfig> = {}): AIAssistantConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const history = (size: number): ConversationMessage[] => Array.from({ length: size }, (_, index) => ({
  role: index % 2 === 0 ? 'user' : 'assistant',
  content: `History message ${index + 1}`,
  timestamp: index,
}));

defineFeature(feature, (test) => {
  let originalApiKey: string | undefined;
  let originalBaseUrl: string | undefined;
  let originalEnvironment: string | undefined;
  let originalFetch: typeof fetch;
  let result: any;
  let formattedResult: any;
  let directResult: any;
  let service: any;
  let requestedModels: string[];
  let backendWarnings: jest.SpyInstance;
  let roomConfig: AIAssistantConfig;

  const configureDatabase = async () => {
    const { supabase } = await import('../services/supabase');
    const queryResult = (table: string) => {
      if (table === 'rooms') return { data: ROOM, error: null };
      if (table === 'ai_assistant_configs') return { data: roomConfig, error: null };
      if (table === 'messages') return { data: [{ id: 'student-message-1' }, { id: 'student-message-2' }], error: null };
      return { data: null, error: null };
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      const query: any = {};
      query.select = jest.fn(() => query);
      query.eq = jest.fn(() => query);
      query.order = jest.fn(() => query);
      query.limit = jest.fn(async () => queryResult(table));
      query.single = jest.fn(async () => queryResult(table));
      query.then = (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(queryResult(table)).then(resolve, reject);
      return query;
    });

    const { buildAIContextFromExistingData } = await import('../services/simplifiedAIContext');
    (buildAIContextFromExistingData as jest.Mock).mockResolvedValue([
      { role: 'system', content: 'Training scenario: verify suspicious messages.' },
      { role: 'user', content: 'Student: Is this message legitimate?' },
    ]);
    const { ChecklistService } = await import('../services/checklistService');
    (ChecklistService.getChecklistByRoom as jest.Mock).mockResolvedValue(null);
    return supabase;
  };

  const loadService = async () => {
    await configureDatabase();
    service = await import('../services/aiService');
    return service;
  };

  const invokeTutorSuggestion = async () => {
    await loadService();
    result = await service.generateTutorSuggestion(ROOM_ID, TUTOR_ID);
  };

  const bindBackground = (given: any) => {
    given('the system has environment variables configured:', (table: Array<{ Variable: string; Description: string }>) => {
      expect(table.map(({ Variable }) => Variable)).toEqual(['REACT_APP_OAI_API_KEY', 'REACT_APP_OAI_BASE_URL']);
      expect(process.env.REACT_APP_OAI_API_KEY).toBe(API_KEY);
      expect(process.env.REACT_APP_OAI_BASE_URL).toBe(BASE_URL);
    });
  };

  beforeEach(() => {
    originalApiKey = process.env.REACT_APP_OAI_API_KEY;
    originalBaseUrl = process.env.REACT_APP_OAI_BASE_URL;
    originalEnvironment = process.env.REACT_APP_ENVIRONMENT;
    originalFetch = global.fetch;
    jest.resetModules();
    jest.clearAllMocks();
    process.env.REACT_APP_OAI_API_KEY = API_KEY;
    process.env.REACT_APP_OAI_BASE_URL = BASE_URL;
    process.env.REACT_APP_ENVIRONMENT = 'production';
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(JSON.stringify(DECISION))) as typeof fetch;
    result = null;
    formattedResult = null;
    directResult = null;
    service = null;
    requestedModels = [];
    roomConfig = configWith();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.REACT_APP_OAI_API_KEY;
    else process.env.REACT_APP_OAI_API_KEY = originalApiKey;
    if (originalBaseUrl === undefined) delete process.env.REACT_APP_OAI_BASE_URL;
    else process.env.REACT_APP_OAI_BASE_URL = originalBaseUrl;
    if (originalEnvironment === undefined) delete process.env.REACT_APP_ENVIRONMENT;
    else process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('System uses the debug dummy suggestion when no API key is configured', ({ given, and, when, then }) => {
    bindBackground(given);
    given('REACT_APP_OAI_API_KEY is not set', () => { delete process.env.REACT_APP_OAI_API_KEY; });
    and('the application environment is debug', () => { process.env.REACT_APP_ENVIRONMENT = 'debug'; });
    when('a tutor requests an AI suggestion', async () => { await invokeTutorSuggestion(); });
    then('the system should use the debug dummy suggestion generator', () => {
      expect(result).toMatchObject({ success: true, decision: { mode: 'tutoring' } });
      expect(global.fetch).not.toHaveBeenCalled();
    });
    and('the response should be from predefined teaching responses', () => {
      expect([
        "Let's explore this concept together. Can you tell me what you already know about it?",
        "That's an interesting question. Let me guide you through the key concepts.",
        "I'll help you understand this better. First, let's start with the basics.",
        'Good thinking! Let\'s work through this step by step.',
        'This is a common challenge. Let me show you a helpful approach.',
      ]).toContain(result.suggestion);
    });
  });

  test('System uses Qwen when API key is configured', ({ given, when, then, and }) => {
    bindBackground(given);
    given('REACT_APP_OAI_API_KEY is set to a valid API key', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    when('a tutor requests an AI suggestion', async () => { await invokeTutorSuggestion(); });
    then('the system should use the QwenService', () => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body)).model).toBe('qwen3.5-flash');
    });
    and("the request should be sent to DashScope's Qwen API", () => {
      expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toBe(`${BASE_URL}/chat/completions`);
    });
    and('the response should be dynamically generated', () => expect(result).toMatchObject({ success: true, suggestion: RESPONSE }));
  });

  test('Custom API endpoint configuration', ({ given, and, when, then }) => {
    bindBackground(given);
    given('REACT_APP_OAI_API_KEY is set', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    and('REACT_APP_OAI_BASE_URL is set to "https://custom-api.example.com"', () => {
      process.env.REACT_APP_OAI_BASE_URL = 'https://custom-api.example.com';
    });
    when('a tutor requests an AI suggestion', async () => {
      await loadService();
      directResult = await service.QwenService.generateResponse('What should I check?', [], roomConfig);
    });
    then('the system should send requests to the custom endpoint', () => {
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://custom-api.example.com/chat/completions');
      expect(directResult.success).toBe(true);
    });
    and('use the provided API key for authentication', () => {
      expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBe(`Bearer ${API_KEY}`);
    });
  });

  test('Qwen service respects room controls', ({ given, and, when, then }) => {
    bindBackground(given);
    given('Qwen integration is active', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    and('a room has AI settings:', (table: Array<{ Setting: string; Value: string }>) => {
      const settings = Object.fromEntries(table.map(({ Setting, Value }) => [Setting, Value]));
      roomConfig.temperature = Number(settings.temperature);
      roomConfig.max_tokens = Number(settings.max_tokens);
      roomConfig.system_prompt = settings.prompt;
    });
    when('generating a suggestion', async () => {
      await loadService();
      result = await service.TutorSuggestionService.generateSuggestion([
        { role: 'user', content: 'Student: Is this message safe?' },
      ], roomConfig);
    });
    then('the Qwen request should use these exact settings', () => {
      const request = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body));
      expect(request).toMatchObject({ model: 'qwen3.5-flash', temperature: 0.7, max_tokens: 300 });
      expect(request.messages[0].content).toContain('Focus on cybersecurity education');
      expect(result).toMatchObject({ success: true, suggestion: RESPONSE });
    });
  });

  test('Visible failure on Qwen errors', ({ given, and, when, then }) => {
    bindBackground(given);
    given('Qwen integration is active', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    and('the Qwen API returns an error', () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'temporarily unavailable' } as Response);
      backendWarnings = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    when('a tutor requests an AI suggestion', async () => { await invokeTutorSuggestion(); });
    then('the Qwen service should return a failed suggestion result', () => expect(result).toMatchObject({ success: false, suggestion: '' }));
    and('the error should include the API status', () => expect(result.error).toContain('503'));
    and('the error should be logged for debugging', () => expect(backendWarnings).toHaveBeenCalledWith('Qwen tutor suggestion failed:', expect.stringContaining('503')));
  });

  test('Response formatting from Qwen', ({ given, when, then, and }) => {
    bindBackground(given);
    given('Qwen integration is active', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    when('Qwen returns a response', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(jsonResponse(RESPONSE))
        .mockResolvedValueOnce(jsonResponse(JSON.stringify(DECISION))) as typeof fetch;
      await loadService();
      directResult = await service.QwenService.generateResponse('What should I check?', [], roomConfig);
      formattedResult = await service.TutorSuggestionService.generateSuggestion([
        { role: 'user', content: 'Student: Is this message safe?' },
      ], roomConfig);
    });
    then('the system should extract the content', () => expect(directResult.content).toBe(RESPONSE));
    and('format it as a tutor suggestion', () => expect(formattedResult).toMatchObject({ success: true, suggestion: RESPONSE }));
    and('include metadata (model_used, response_time_ms)', () => {
      expect(directResult.model_used).toBe('qwen3.5-flash');
      expect(directResult.response_time_ms).toEqual(expect.any(Number));
      expect(directResult.response_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  test('Cost-effective API usage', ({ given, then }) => {
    bindBackground(given);
    given('Qwen integration is active', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    then('the system should:', async (table: Array<{ Optimization: string; Implementation: string }>) => {
      await loadService();
      const conversation = history(12);
      await service.QwenService.generateResponse('Current question', conversation, roomConfig);
      const firstRequest = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body));
      expect(firstRequest.messages).toHaveLength(12);
      expect(firstRequest.messages.map((message: any) => message.content)).not.toContain('History message 1');
      expect(firstRequest.messages.map((message: any) => message.content)).toContain('History message 12');
      expect(firstRequest.max_tokens).toBe(300);
      expect(table.map(({ Implementation }) => Implementation)).toHaveLength(3);

      await service.QwenService.generateResponse('Current question', conversation, roomConfig);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  test('Security of API credentials', ({ given, then }) => {
    bindBackground(given);
    given('REACT_APP_OAI_API_KEY is configured', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    then('the API key should never be:', async (table: Array<{ 'Exposed in': string; 'Protection Method': string }>) => {
      expect(table).toHaveLength(4);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => `Authentication rejected token ${API_KEY}`,
      } as Response);
      backendWarnings = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      await invokeTutorSuggestion();
      const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1];
      const { supabase } = await import('../services/supabase');
      expect({
        exposedInBrowserRequest: fetchOptions.headers.Authorization === `Bearer ${API_KEY}`,
        includedInError: String(result.error).includes(API_KEY),
        includedInLogs: JSON.stringify(backendWarnings.mock.calls).includes(API_KEY),
        storedThroughSupabase: JSON.stringify((supabase.from as jest.Mock).mock.calls).includes(API_KEY),
      }).toEqual({
        exposedInBrowserRequest: false,
        includedInError: false,
        includedInLogs: false,
        storedThroughSupabase: false,
      });
    });
  });

  test('Only Qwen model is selectable', ({ given, when, then }) => {
    bindBackground(given);
    given('Qwen integration is active', () => { process.env.REACT_APP_OAI_API_KEY = API_KEY; });
    when('a tutor selects different models:', (table: Array<{ 'Model Selected': string; 'API Model Used': string }>) => {
      requestedModels = table.map(({ 'Model Selected': model }) => model);
    });
    then('the system should use the appropriate model', async () => {
      await loadService();
      for (const selectedModel of requestedModels) {
        await service.QwenService.generateResponse('What should I check?', [], configWith({ model_name: selectedModel }));
      }
      const requests = (global.fetch as jest.Mock).mock.calls.map((call) => JSON.parse(String(call[1].body)));
      expect(requests.map((request: any) => request.model)).toEqual(['qwen3.5-flash']);
    });
  });
});
